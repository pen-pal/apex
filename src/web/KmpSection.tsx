// KMP, made visible. The pattern's failure table is shown; step through the search and
// watch the pattern align under the text, the current comparison highlight green (match)
// or red (mismatch), and on a mismatch the pattern SLIDE by the failure function rather
// than the text pointer moving back. Real KMP in kmp.ts (tested).
import { useMemo, useState } from 'react';
import { failure, search } from './kmp';

export function KmpSection() {
  const [text, setText] = useState('ABABABACABA');
  const [pat, setPat] = useState('ABABAC');
  const pi = useMemo(() => failure(pat), [pat]);
  const res = useMemo(() => search(text, pat), [text, pat]);
  const [step, setStep] = useState(1e9);

  const s = Math.min(step, res.steps.length);
  const cur = s > 0 ? res.steps[s - 1] : null;
  // pattern offset = where pattern[0] sits under the text at this step
  const offset = cur ? cur.textIndex - cur.patIndex : 0;
  const foundSoFar = res.matches.filter((m) => cur && m + pat.length - 1 <= cur.textIndex);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>KMP — search without ever looking back</h2></div>
        <p className="jsec-sub">
          A naive search re-checks the text from scratch after every mismatch. KMP precomputes a <strong>failure function</strong>: for
          each position in the pattern, the length of the longest prefix that’s also a suffix there. On a mismatch it slides the pattern
          by that amount — the already-matched prefix is guaranteed to line up — so the <em>text</em> pointer only ever moves forward, and
          the whole search is O(n+m).
        </p>

        <div className="kmp-io">
          <label>text <input value={text} onChange={(e) => { setText(e.target.value.toUpperCase()); setStep(1e9); }} spellCheck={false} /></label>
          <label>pattern <input value={pat} onChange={(e) => { setPat(e.target.value.toUpperCase()); setStep(1e9); }} spellCheck={false} /></label>
        </div>

        <div className="kmp-failtable">
          <div className="kmp-ftlabel">failure table π:</div>
          <div className="kmp-ftrow">{[...pat].map((ch, i) => <span key={i} className="kmp-ftcell"><b>{ch}</b><i>{pi[i]}</i></span>)}</div>
        </div>

        <div className="kmp-controls">
          <button onClick={() => setStep(0)} disabled={s === 0}>⏮</button>
          <button onClick={() => setStep(Math.max(0, s - 1))} disabled={s === 0}>◀</button>
          <span className="kmp-count">step {s} / {res.steps.length}</span>
          <button onClick={() => setStep(s + 1)} disabled={s >= res.steps.length}>▶</button>
          <button onClick={() => setStep(res.steps.length)} disabled={s >= res.steps.length}>⏭</button>
        </div>

        <div className="kmp-align">
          <div className="kmp-textrow">
            {[...text].map((ch, i) => (
              <span key={i} className={`kmp-tc ${cur && i === cur.textIndex ? (cur.match ? 'hit' : 'miss') : ''} ${foundSoFar.some((m) => i >= m && i < m + pat.length) ? 'matched' : ''}`}>{ch}</span>
            ))}
          </div>
          {cur && (
            <div className="kmp-patrow" style={{ marginLeft: `${offset * 26}px` }}>
              {[...pat].map((ch, i) => (
                <span key={i} className={`kmp-pc ${i === cur.patIndex ? (cur.match ? 'hit' : 'miss') : i < cur.patIndex ? 'ok' : ''}`}>{ch}</span>
              ))}
            </div>
          )}
        </div>

        {cur && (
          <div className="kmp-msg">
            {cur.jumpedTo !== null
              ? `mismatch at pattern[${cur.patIndex}] → slide: jump the pattern to π[${cur.patIndex - 1}] = ${cur.jumpedTo} (text pointer stays put)`
              : cur.match ? `text[${cur.textIndex}] = pattern[${cur.patIndex}] ✓ — extend the match`
              : `text[${cur.textIndex}] ≠ pattern[${cur.patIndex}] ✗`}
          </div>
        )}

        <div className="kmp-stats">
          <span>matches at: <b>{res.matches.length ? res.matches.join(', ') : 'none'}</b></span>
          <span><b>{res.comparisons}</b> comparisons (naive worst case ≈ {text.length * pat.length})</span>
        </div>

        <p className="kmp-foot">
          The failure table is itself built by KMP-on-itself in O(m). The text index never decreases, so each character is
          examined at most twice — O(n+m) total, versus O(n·m) for naive matching on adversarial inputs like “AAAA…AAB”. Boyer-Moore goes
          further by scanning the pattern right-to-left and skipping ahead on a mismatch (often sublinear in practice), and Rabin-Karp uses
          a rolling hash to find multiple patterns at once.
        </p>
      </section>
    </div>
  );
}
