// Verify every multi-language code example actually compiles and prints its expected value — so the Go/Python/Rust/C/C++
// snippets in src/web/langSamples.ts stay as honest as the tested TS models, not plausible-looking slop. Compiles and
// runs each snippet with the real toolchain; a language whose toolchain is absent is SKIPPED (warned), a wrong output
// FAILS. Run: `node scripts/verify-code-examples.mjs` (locally, or in CI with go/rustc/cc/c++/python3 installed).
import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Load the data module (strip TS types via esbuild so plain node can import it).
const ts = readFileSync('src/web/langSamples.ts', 'utf8');
const js = esbuild.transformSync(ts, { loader: 'ts', format: 'esm' }).code;
const work = mkdtempSync(join(tmpdir(), 'apex-codeex-'));
const modPath = join(work, 'codeExamples.mjs');
writeFileSync(modPath, js);
const { CODE_EXAMPLES } = await import(pathToFileURL(modPath).href);

const have = (bin, args = ['--version']) => { try { execFileSync(bin, args, { stdio: 'ignore' }); return true; } catch { return false; } };
const run = (file, out) => execFileSync(join(work, file), [], { cwd: work, timeout: 30000, encoding: 'utf8' });

// Each language: how to write, (optionally) compile, and run a snippet, returning trimmed stdout.
const RUNNERS = {
  python: { tool: ['python3'], exec: (code, i) => { const f = `k${i}.py`; writeFileSync(join(work, f), code); return execFileSync('python3', [f], { cwd: work, timeout: 30000, encoding: 'utf8' }); } },
  go: { tool: ['go', ['version']], exec: (code, i) => { const f = `k${i}.go`; writeFileSync(join(work, f), code); return execFileSync('go', ['run', f], { cwd: work, timeout: 60000, encoding: 'utf8', env: { ...process.env, GO111MODULE: 'off' } }); } },
  rust: { tool: ['rustc', ['--version']], exec: (code, i) => { const f = `k${i}.rs`, b = `kr${i}`; writeFileSync(join(work, f), code); execFileSync('rustc', ['-O', f, '-o', b], { cwd: work, timeout: 60000 }); return run(b); } },
  c: { tool: ['cc'], exec: (code, i) => { const f = `k${i}.c`, b = `kc${i}`; writeFileSync(join(work, f), code); execFileSync('cc', ['-O2', f, '-o', b], { cwd: work, timeout: 60000 }); return run(b); } },
  cpp: { tool: ['c++'], exec: (code, i) => { const f = `k${i}.cpp`, b = `kx${i}`; writeFileSync(join(work, f), code); execFileSync('c++', ['-O2', f, '-o', b], { cwd: work, timeout: 60000 }); return run(b); } },
};

let pass = 0, fail = 0, skip = 0;
const fails = [];
let idx = 0;
for (const [section, set] of Object.entries(CODE_EXAMPLES)) {
  for (const snip of set.snippets) {
    const r = RUNNERS[snip.lang];
    if (!r) { fails.push(`${section}/${snip.lang}: no runner`); fail++; continue; }
    if (!have(r.tool[0], r.tool[1])) { console.warn(`  ~ skip ${section}/${snip.lang} (toolchain absent)`); skip++; continue; }
    try {
      const got = String(r.exec(snip.code, idx++)).trim();
      if (got === set.expect.trim()) { pass++; }
      else { fail++; fails.push(`${section}/${snip.lang}: expected "${set.expect}" got "${got}"`); }
    } catch (e) { fail++; fails.push(`${section}/${snip.lang}: ${String(e.message).split('\n')[0]}`); }
  }
}
rmSync(work, { recursive: true, force: true });

console.log(`\ncode examples: ${pass} passed, ${fail} failed, ${skip} skipped`);
if (fails.length) { console.error('FAILURES:\n  ' + fails.join('\n  ')); process.exit(1); }
if (pass === 0) { console.warn('no snippets verified (no toolchains present) — not failing, but nothing was checked.'); }
