// "In other languages" — the section's core idea in Go / Python / Rust / C / C++, beside the tested TS model. Read-only
// (Apex doesn't execute them); kept honest by scripts/verify-code-examples.mjs, which compiles and runs each snippet and
// checks it prints the same value. Collapsed by default, tabbed by language, with a copy button. Data in langSamples.ts.
import { useState } from 'react';
import { hasExamples, examplesFor, LANGS, type Lang } from './langSamples';

export function CodeExamples({ id }: { id: string }) {
  const set = examplesFor(id);
  const langs = LANGS.filter((l) => set?.snippets.some((s) => s.lang === l.id));
  const [lang, setLang] = useState<Lang>(langs[0]?.id ?? 'python');
  const [copied, setCopied] = useState(false);
  if (!hasExamples(id) || !set) return null;

  const snip = set.snippets.find((s) => s.lang === lang) ?? set.snippets[0];
  const copy = () => { navigator.clipboard?.writeText(snip.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  return (
    <details className="codex">
      <summary className="codex-sum">
        <span className="codex-icon">◇</span> In other languages — <span className="codex-langs">{langs.map((l) => l.label).join(' · ')}</span>
        <span className="codex-hint">the same idea beside the TS model; each snippet is compiled and run by a verify script</span>
      </summary>
      <div className="codex-body">
        <p className="codex-intro">{set.intro}</p>
        <div className="codex-tabs" role="tablist">
          {langs.map((l) => (
            <button key={l.id} type="button" role="tab" aria-selected={l.id === lang} className={l.id === lang ? 'on' : ''} onClick={() => setLang(l.id)}>{l.label}</button>
          ))}
          <span className="codex-spacer" />
          <button type="button" className="codex-copy" onClick={copy}>{copied ? '✓ copied' : 'copy'}</button>
        </div>
        <pre className="codex-code"><code>{snip.code}</code></pre>
        <div className="codex-verified">✓ all {langs.length} print <code>{set.expect}</code> — verified by <code>npm run verify:code</code></div>
      </div>
    </details>
  );
}
