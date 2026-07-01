// The Z-algorithm, made visible. Type a pattern and a text; we build "pattern § text" and compute the Z-array
// under every character. Z[i] is how much of the string's PREFIX (your pattern) reappears starting at i — so
// every position in the text region where Z[i] ≥ |pattern| is a match, lit up green. Watch how one linear
// pass finds every occurrence (including overlapping ones). Real model from zalgo.ts.
import { useMemo, useState } from 'react';
import { matchTrace, search } from './zalgo';

export function ZalgoSection() {
  const [text, setText] = useState('abracadabra');
  const [pattern, setPattern] = useState('abra');

  const { combined, z, sepIndex } = useMemo(() => matchTrace(text, pattern), [text, pattern]);
  const m = [...pattern].length;
  const matches = useMemo(() => search(text, pattern), [text, pattern]);

  return (
    <div className="zal">
      <p className="zal-intro">
        Z[i] is the length of the longest run starting at position i that also matches the string's
        <strong> prefix</strong>. Search is a trick on top: build <code>pattern § text</code> (§ is a separator
        in neither), compute the Z-array in one linear pass, and every spot in the text where
        <strong> Z[i] ≥ |pattern|</strong> is a match. Edit either box:
      </p>

      <div className="zal-inputs">
        <label>pattern<input value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} maxLength={12} /></label>
        <label>text<input value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} maxLength={40} /></label>
      </div>

      <div className="zal-strip" role="list">
        {combined.map((ch, i) => {
          const isSep = i === sepIndex;
          const inText = i > sepIndex;
          const isMatch = inText && m > 0 && z[i] >= m;
          const cls = isSep ? 'sep' : i < sepIndex ? 'pat' : isMatch ? 'match' : 'text';
          return (
            <div key={i} className={`zal-cell ${cls}`} role="listitem" title={`Z[${i}] = ${z[i]}`}>
              <span className="zal-ch">{ch === ' ' ? '␣' : ch}</span>
              <span className="zal-z">{isSep ? '—' : z[i]}</span>
            </div>
          );
        })}
      </div>

      <div className="zal-result">
        {m === 0 ? (
          <span className="zal-none">type a pattern to search</span>
        ) : matches.length ? (
          <span className="zal-hits">✓ found <b>{matches.length}</b> {matches.length === 1 ? 'match' : 'matches'} at text position{matches.length === 1 ? '' : 's'} <b>{matches.join(', ')}</b> — each is a cell where Z ≥ {m}</span>
        ) : (
          <span className="zal-nohit">no occurrence of <b>{pattern}</b> in the text</span>
        )}
      </div>

      <p className="zal-foot">
        Why it's linear: the algorithm remembers the rightmost window <code>[l, r)</code> it has already verified
        matches the prefix. When i lands inside that window, the value at the mirror position <code>i−l</code> is
        already known, so Z[i] can be <em>copied</em> (capped at the window's edge) with zero new comparisons;
        only characters past <code>r</code> are ever compared, and r only moves forward — so the total work is
        O(n+m). It's the same asymptotics as KMP's failure function and solves the same problems (matching,
        counting occurrences, finding borders and periods), but the Z-array is often the easier mental model:
        "how much of the start do I see again here?" The separator matters — without it a run could span the
        pattern/text boundary and report a false match. (Gusfield, 1997.)
      </p>
    </div>
  );
}
