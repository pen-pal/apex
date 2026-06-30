// Boyer-Moore, made visible. The pattern sits under the text and is compared from the right; step through
// the alignments and watch a mismatch slide the pattern forward by the bad-character rule — often leaping
// several characters at once (a whole pattern length when the text char isn't in the pattern at all). The
// comparison counter shows how much it skips versus a naive scan. Real model from boyermoore.ts.
import { useMemo, useState } from 'react';
import { search, naiveComparisons } from './boyermoore';

export function BoyerMooreSection() {
  const [text, setText] = useState('HERE IS A SIMPLE EXAMPLE');
  const [pattern, setPattern] = useState('EXAMPLE');
  const [step, setStep] = useState(0);

  const r = useMemo(() => search(text, pattern), [text, pattern]);
  const naive = useMemo(() => naiveComparisons(text, pattern), [text, pattern]);
  const cur = r.steps[Math.min(step, r.steps.length - 1)];
  const align = cur?.align ?? 0;

  const reset = (t: string, p: string) => { setText(t); setPattern(p); setStep(0); };

  return (
    <div className="bm">
      <div className="bm-inputs">
        <label>text <input value={text} spellCheck={false} onChange={(e) => reset(e.target.value, pattern)} /></label>
        <label>pattern <input value={pattern} spellCheck={false} onChange={(e) => reset(text, e.target.value)} /></label>
      </div>

      <div className="bm-align">
        <div className="bm-tape">
          {[...text].map((c, i) => {
            const inWindow = cur && i >= align && i < align + pattern.length;
            const isMismatch = cur && !cur.matched && i === align + cur.mismatchAt;
            const isMatch = cur?.matched && inWindow;
            return <span key={i} className={`bm-ch ${isMismatch ? 'bad' : isMatch ? 'hit' : inWindow ? 'win' : ''}`}>{c === ' ' ? '·' : c}</span>;
          })}
        </div>
        <div className="bm-tape pat" style={{ marginLeft: `${align * 22}px` }}>
          {[...pattern].map((c, j) => {
            const compared = cur && !cur.matched && j >= cur.mismatchAt;
            const isMismatch = cur && !cur.matched && j === cur.mismatchAt;
            return <span key={j} className={`bm-ch ${isMismatch ? 'bad' : cur?.matched ? 'hit' : compared ? 'cmp' : ''}`}>{c === ' ' ? '·' : c}</span>;
          })}
        </div>
      </div>

      <div className="bm-info">
        {!cur ? 'no alignments' : cur.matched
          ? <>✓ <b>match at index {cur.align}</b> — shift by 1 to look for overlaps</>
          : <>mismatch at the <b>{cur.badChar === ' ' ? 'space' : `“${cur.badChar}”`}</b> — it’s {r.last[cur.badChar] === undefined ? 'not in the pattern, so jump the whole pattern past it' : `last seen at pattern index ${r.last[cur.badChar]}, so align there`} → <b>shift {cur.shift}</b></>}
      </div>

      <div className="bm-steps">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(r.steps.length - 1, s + 1))} disabled={step >= r.steps.length - 1}>step ▶</button>
        <button type="button" onClick={() => setStep(r.steps.length - 1)} disabled={step >= r.steps.length - 1}>end</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
        <span className="bm-stepn">alignment {step + 1} / {r.steps.length}</span>
      </div>

      <div className="bm-bottom">
        <div className="bm-table">
          <div className="bm-table-h">bad-character table (last index in pattern)</div>
          <div className="bm-cells">
            {[...new Set(pattern)].map((c) => <span key={c} className="bm-cell"><b>{c === ' ' ? '·' : c}</b>{r.last[c]}</span>)}
            <span className="bm-cell other"><b>other</b>−1 → jump {pattern.length}</span>
          </div>
        </div>
        <div className="bm-cmp">
          <div className="bm-cmp-row"><span>Boyer-Moore</span><b className="g">{r.comparisons}</b> comparisons</div>
          <div className="bm-cmp-row"><span>naive scan</span><b>{naive}</b> comparisons</div>
          <div className="bm-cmp-row"><span>matches</span><b>{r.matches.length ? r.matches.join(', ') : 'none'}</b></div>
        </div>
      </div>

      <p className="bm-foot">
        Comparing right-to-left is the key insight: a single look at the pattern’s last character often proves the whole window can’t match, and
        the bad-character rule turns that into a big jump. When the alphabet is large relative to the pattern (English text, say), most text
        characters aren’t in the pattern at all, so Boyer-Moore skips ~m characters at a time and inspects only a fraction of the input —
        <strong> sublinear</strong> in practice, the opposite of KMP which reads every character once. Real implementations also add the
        <em> good-suffix</em> rule (reuse the matched suffix) and take the larger of the two shifts; <code>grep -F</code> and most editors’ find
        use a Boyer-Moore variant. Compare with <strong>KMP</strong> (no backtracking, left-to-right) and <strong>Rabin-Karp</strong> (rolling hash). (Boyer &amp; Moore, 1977.)
      </p>
    </div>
  );
}
