#!/usr/bin/env node
// anti-slop.mjs — mechanical enforcement of the rules in CLAUDE.md.
//
// Two severities:
//   ERROR (exit 1): high-confidence, mechanical. These fail CI.
//   WARN  (exit 0): needs human judgment. Reported, never blocks.
//
// This is deliberately conservative: a false ERROR that blocks a good PR is worse
// than a missed WARN, so anything ambiguous is a WARN. It cannot catch everything
// (see the notes under each check) — CLAUDE.md still governs the judgment calls.
//
// Zero dependencies. Run: node scripts/anti-slop.mjs [rootDir]

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, basename } from 'node:path';

const ROOT = process.argv[2] ?? process.cwd();

// ---- config: tune per repo ------------------------------------------------
const CONFIG = {
  sourceDirs: ['src', 'app', 'lib'],       // where product code lives
  docFiles: ['README.md', 'index.html'],   // files whose claims must match reality
  ignore: new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.next', 'out']),
  codeExt: new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']),
  fileLineLimit: 800,        // ERROR above this: a file this large is unreviewable
  dispatchWarnAt: 40,        // WARN above this many inline `=== '...'` blocks in one file
  utilDupWarnAt: 3,          // WARN when a util-like name is defined in >= N files
  hypeWarnAt: 8,            // WARN when hype phrases exceed this repo-wide
  // deps that are legitimately runtime-only / loaded indirectly (won't show as imports)
  depAllowlist: new Set(['react-dom', 'react']),
  // util names whose duplication across files is the classic copy-paste smell
  utilNames: ['hex', 'enc', 'dec', 'fromhex', 'tohex', 'concat', 'concatbytes',
    'sleep', 'clamp', 'range', 'assert', 'xor', 'rotl', 'rotr', 'bytes'],
  // phrases only — single common words ("actually") drown signal in noise
  hypePhrases: [/nothing is faked/gi, /correctness-first/gi, /\bthe bytes are real\b/gi,
    /no hand-waving/gi, /\bbullet-?proof\b/gi, /\bblazing(ly)?[ ,-]/gi,
    /\bbattle-tested\b/gi, /\bworld-class\b/gi, /\bstate-of-the-art\b/gi],
  trackingClaims: [/no tracking/gi, /zero telemetry/gi, /no analytics/gi],   // ERROR: directly falsified by an analytics SDK
  architectureClaims: [/no backend/gi, /fully static/gi],                    // WARN: technically true, but readers infer no phoning home
  telemetryDeps: [/analytics/i, /speed-insights/i, /telemetry/i, /sentry/i, /posthog/i, /mixpanel/i, /segment/i],
};
// ---------------------------------------------------------------------------

const findings = [];
const add = (sev, rule, file, line, msg) =>
  findings.push({ sev, rule, file: relative(ROOT, file), line, msg });

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (CONFIG.ignore.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const allFiles = walk(ROOT);
const sourceFiles = allFiles.filter(
  (f) => CONFIG.codeExt.has(extname(f)) &&
    CONFIG.sourceDirs.some((d) => relative(ROOT, f).split('/')[0] === d));
const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

// R1 — hardcoded metrics & fake badges -------------------------------------
// Catches: badges with a hand-typed count linking to `#`; the same noun given
// two different numbers across doc files (a self-contradiction). Bare "N nouns"
// claims are only WARNed — some are legitimate.
function checkMetrics() {
  const nounCounts = new Map(); // noun -> Map(number -> [file:line])
  const nounRe = /(~|\b)(\d{2,}(?:[,_]\d{3})*)\+?[ \t]+(?:[a-z][\w-]*,?[ \t]+){0,3}?(sections?|tests?|protocols?|visualizations?|widgets?|models?|components?|items?|entries|examples?)\b/gi;
  for (const f of [...CONFIG.docFiles.map((d) => join(ROOT, d)), join(ROOT, 'package.json')]) {
    if (!existsSync(f)) continue;
    // blank out fenced code blocks (```…```): command output is not a prose claim.
    // Replacement preserves length/newlines so reported line numbers stay exact.
    const text = read(f).replace(/```[\s\S]*?```/g, (b) => b.replace(/[^\n]/g, ' '));
    // fake/hardcoded badge: a shields.io count that links nowhere real
    const badgeRe = /shields\.io\/badge\/[^)\]]*?(\d[\d,_]*)[^)\]]*passing[^)]*\)\]\(#\)/gi;
    for (const m of text.matchAll(badgeRe))
      add('ERROR', 'R1', f, lineOf(text, m.index),
        `hardcoded "${m[1].replace(/[,_]/g, '')} passing" badge linking to "#": wire it to real CI output or remove it`);
    // collect "N noun" claims for cross-file contradiction detection
    for (const m of text.matchAll(nounRe)) {
      const noun = m[3].toLowerCase().replace(/s$/, '');
      const num = m[2].replace(/[,_]/g, '');
      if (!nounCounts.has(noun)) nounCounts.set(noun, new Map());
      const byNum = nounCounts.get(noun);
      if (!byNum.has(num)) byNum.set(num, []);
      byNum.get(num).push(`${relative(ROOT, f)}:${lineOf(text, m.index)}`);
      add('WARN', 'R1', f, lineOf(text, m.index),
        `hand-typed metric "${m[0].trim()}": derive it from a script/CI or omit it — it will drift`);
    }
  }
  for (const [noun, byNum] of nounCounts)
    if (byNum.size > 1)
      add('ERROR', 'R1', join(ROOT, CONFIG.docFiles[0] ?? 'README.md'), 0,
        `contradictory counts for "${noun}": ${[...byNum.entries()].map(([n, w]) => `${n} (${w.join(', ')})`).join(' vs ')}`);
}

// R2 — stale count comments -------------------------------------------------
// A count inside a comment is a claim that silently rots. WARN so a human checks
// it against the code; we can't always know the true count generically.
function checkCommentCounts() {
  // A real count-claim reads "the 32 sections" / "these 5 steps" — a determiner then a
  // number then a collection noun. Require the determiner so we skip citations
  // ("RFC 1035, section 4", "IEEE 754"), version/field numbers, and compound
  // adjectives ("16-byte state"). This trades recall for precision on purpose:
  // R2 is a nudge, and a noisy nudge gets muted.
  const re = /(?:\/\/|\*|#)[^\n]*?\b(?:the|these|all|our|now)\s+(\d{1,4})\s+(sections?|items?|entries|rules?|steps?|columns?|categories|groups?|areas?|topics?)\b/gi;
  for (const f of sourceFiles) {
    const text = read(f);
    for (const m of text.matchAll(re)) {
      if (/-\s*$/.test(text.slice(m.index, m.index + m[0].length - m[2].length))) continue; // "16-byte"
      add('WARN', 'R2', f, lineOf(text, m.index),
        `comment asserts a count ("${m[1]} ${m[2]}") — verify it still matches the code, or drop the number`);
    }
  }
}

// R3a — dead dependencies ---------------------------------------------------
// A runtime dependency never imported anywhere in source is dead weight. ERROR.
function checkDeadDeps() {
  const pkgPath = join(ROOT, 'package.json');
  if (!existsSync(pkgPath)) return;
  let pkg;
  try { pkg = JSON.parse(read(pkgPath)); } catch { return; }
  const deps = Object.keys(pkg.dependencies ?? {});
  if (!deps.length) return;
  // usage can live outside sourceDirs (root vite/next configs, HTML script tags)
  const usageFiles = allFiles.filter((f) => CONFIG.codeExt.has(extname(f)) || extname(f) === '.html');
  const haystack = usageFiles.map(read).join('\n');
  for (const dep of deps) {
    if (CONFIG.depAllowlist.has(dep)) continue;
    // match `from 'dep'`, `from 'dep/sub'`, `require('dep')`, `import('dep')`
    const esc = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const used = new RegExp(`(from\\s+['"]|require\\(['"]|import\\(['"])${esc}(['"/])`).test(haystack);
    if (!used)
      add('ERROR', 'R3', pkgPath, 0,
        `dependency "${dep}" is never imported in source — remove it, or import it where it's actually needed`);
  }
}

// R3b — claim vs telemetry --------------------------------------------------
// "no backend / fully static" while shipping an analytics SDK is a claim the
// artifact contradicts. ERROR.
function checkClaimVsTelemetry() {
  const pkgPath = join(ROOT, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(read(pkgPath) || '{}') : {};
  const deps = Object.keys(pkg.dependencies ?? {});
  const telemetry = deps.filter((d) => CONFIG.telemetryDeps.some((re) => re.test(d)));
  if (!telemetry.length) return;
  for (const d of CONFIG.docFiles) {
    const f = join(ROOT, d);
    if (!existsSync(f)) continue;
    const text = read(f);
    for (const re of CONFIG.trackingClaims) {
      const m = re.exec(text); re.lastIndex = 0;
      if (m)
        add('ERROR', 'R3', f, lineOf(text, m.index),
          `claims "${m[0]}" but ships telemetry deps [${telemetry.join(', ')}] — make the claim match the artifact`);
    }
    for (const re of CONFIG.architectureClaims) {
      const m = re.exec(text); re.lastIndex = 0;
      if (m)
        add('WARN', 'R3', f, lineOf(text, m.index),
          `claims "${m[0]}" while shipping telemetry [${telemetry.join(', ')}] — readers will assume no phoning home; scope the claim or drop the beacons`);
    }
  }
}

// R4a — duplicated utilities ------------------------------------------------
// The same tiny helper redefined across files. WARN (suggest one shared module).
function checkDuplicateUtils() {
  const defs = new Map(); // name -> Set(file)
  const defRe = /(?:export\s+)?(?:const|function)\s+([A-Za-z_$][\w$]*)\s*[=(]/g;
  for (const f of sourceFiles) {
    const text = read(f);
    for (const m of text.matchAll(defRe)) {
      const name = m[1].toLowerCase();
      if (!CONFIG.utilNames.includes(name)) continue;
      if (!defs.has(name)) defs.set(name, new Set());
      defs.get(name).add(relative(ROOT, f));
    }
  }
  for (const [name, files] of defs)
    if (files.size >= CONFIG.utilDupWarnAt)
      add('WARN', 'R4', join(ROOT, [...files][0]), 0,
        `"${name}" is defined in ${files.size} files (${[...files].slice(0, 4).join(', ')}${files.size > 4 ? ', …' : ''}) — extract one shared util`);
}

// R4b — monolith files ------------------------------------------------------
function checkFileSize() {
  for (const f of sourceFiles) {
    const text = read(f);
    const lines = text.split('\n').length;
    if (lines > CONFIG.fileLineLimit)
      add('ERROR', 'R4', f, 0,
        `${lines} lines (limit ${CONFIG.fileLineLimit}) — split it; a file this size can't be reviewed as a unit`);
    // count per left-hand identifier so `mode === 'x'` and `other === 'y'` don't pool
    const perIdent = new Map();
    for (const m of text.matchAll(/(\w+)\s*===\s*['"][\w-]+['"]/g))
      perIdent.set(m[1], (perIdent.get(m[1]) ?? 0) + 1);
    for (const [ident, n] of perIdent)
      if (n >= CONFIG.dispatchWarnAt)
        add('WARN', 'R4', f, 0,
          `${n} inline \`${ident} === '...'\` dispatch blocks — replace with a data-driven registry so adding a case is one row`);
  }
}

// R5 — hype prose -----------------------------------------------------------
function checkHype() {
  let total = 0;
  const hits = [];
  for (const f of [...sourceFiles, ...CONFIG.docFiles.map((d) => join(ROOT, d))]) {
    if (!existsSync(f)) continue;
    const text = read(f);
    for (const re of CONFIG.hypePhrases)
      for (const m of text.matchAll(re)) { total++; hits.push({ f, i: m.index, w: m[0] }); }
  }
  if (total >= CONFIG.hypeWarnAt) {
    add('WARN', 'R5', hits[0].f, lineOf(read(hits[0].f), hits[0].i),
      `${total} hype/filler phrases repo-wide (e.g. "${hits.slice(0, 3).map((h) => h.w).join('", "')}") — cut reassurance prose; let tests carry the claim`);
  }
}

// R6 — self-referential tests -----------------------------------------------
// Flags expected values that re-state the implementation's own formula/constants
// rather than an independent value. WARN (the fast-vs-slow oracle pattern is fine).
function checkSelfRefTests() {
  const testFiles = allFiles.filter((f) => /\.test\.[cm]?[jt]sx?$/.test(f));
  for (const f of testFiles) {
    const text = read(f);
    // imported ALL_CAPS constants from the module under test
    const consts = new Set();
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\.?\/[^'"]+['"]/g))
      for (const part of m[1].split(','))
        if (/^[A-Z][A-Z0-9_]*$/.test(part.trim())) consts.add(part.trim());
    const lines = text.split('\n');
    lines.forEach((ln, i) => {
      if (!/\bexpect\(/.test(ln)) return;
      const expected = ln.split(/(?:toBe(?:CloseTo)?|toEqual|toStrictEqual)\(/)[1] ?? '';
      // Only flag when the expected side RECOMPUTES a formula — merely comparing to an
      // imported constant (`expect(clamp(x)).toBe(MAX)`) is a legitimate property test.
      // The tell is arithmetic/Math applied to the module's own constant, i.e. the test
      // re-derives the implementation instead of stating an independent expected value.
      const recomputesMath = /(?:toBe(?:CloseTo)?|toEqual|toStrictEqual)\(\s*Math\.\w+\s*\(/.test(ln);
      const arithOnConst = [...consts].some((c) =>
        new RegExp(`\\b${c}\\b\\s*[-+*/]|[-+*/]\\s*\\b${c}\\b|Math\\.\\w+\\([^)]*\\b${c}\\b`).test(expected));
      if (recomputesMath || arithOnConst)
        add('WARN', 'R6', f, i + 1,
          `expected value recomputes the implementation's own formula (${arithOnConst ? 'arithmetic on an imported constant' : 'Math.* re-derivation'}) — assert a property or an external value instead`);
    });
  }
}

// ---- run + report ---------------------------------------------------------
[checkMetrics, checkCommentCounts, checkDeadDeps, checkClaimVsTelemetry,
  checkDuplicateUtils, checkFileSize, checkHype, checkSelfRefTests].forEach((fn) => fn());

const errors = findings.filter((f) => f.sev === 'ERROR');
const warns = findings.filter((f) => f.sev === 'WARN');
const RULE = {
  R1: 'no hand-typed metrics', R2: 'comments match code', R3: 'nothing dead',
  R4: 'consolidate, no monoliths', R5: 'no brochure prose', R6: 'independent test oracles',
};
const line = (f) => `  ${f.sev === 'ERROR' ? '✗' : '•'} [${f.rule}] ${f.file}${f.line ? `:${f.line}` : ''}\n      ${f.msg}`;

console.log(`\nanti-slop: scanned ${sourceFiles.length} source files under ${relative(process.cwd(), ROOT) || '.'}\n`);
if (errors.length) {
  console.log(`ERRORS (${errors.length}) — these fail CI:`);
  errors.forEach((f) => console.log(line(f)));
  console.log('');
}
if (warns.length) {
  console.log(`WARNINGS (${warns.length}) — review, non-blocking:`);
  warns.forEach((f) => console.log(line(f)));
  console.log('');
}
if (!findings.length) console.log('clean — no slop patterns detected.\n');
console.log(`rules: ${Object.entries(RULE).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
process.exit(errors.length ? 1 : 0);
