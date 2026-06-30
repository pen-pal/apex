// Suffix array, made visible. Every suffix of the string, sorted; because they're sorted, all
// occurrences of a pattern form one contiguous block — type a pattern and watch that block (and the
// matching text positions) light up, found by binary search. Real index from suffixarray.ts.
import { useMemo, useState } from 'react';
import { buildSuffixArray, sortedSuffixes, search } from './suffixarray';

export function SuffixArraySection() {
  const [text, setText] = useState('banana');
  const [pattern, setPattern] = useState('ana');
  const clean = (text.toLowerCase().replace(/[^a-z$]/g, '') || 'a').slice(0, 14);
  const pat = pattern.toLowerCase().replace(/[^a-z$]/g, '');

  const sa = useMemo(() => buildSuffixArray(clean), [clean]);
  const suffixes = useMemo(() => sortedSuffixes(clean, sa), [clean, sa]);
  const res = useMemo(() => (pat ? search(clean, sa, pat) : { lo: 0, hi: 0, positions: [] }), [clean, sa, pat]);
  const matchSet = new Set(res.positions);

  return (
    <div className="sfa">
      <div className="sfa-in">
        <label>string <input value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} /></label>
        <label>search <input value={pattern} spellCheck={false} onChange={(e) => setPattern(e.target.value)} /></label>
      </div>

      <div className="sfa-text">
        {[...clean].map((c, i) => <span key={i} className={`sfa-tc ${matchSet.has(i) ? 'hit' : ''}`}>{c}</span>)}
        <span className="sfa-tres">{pat ? (res.positions.length ? `“${pat}” at ${res.positions.join(', ')}` : `“${pat}” not found`) : ''}</span>
      </div>

      <div className="sfa-table">
        <div className="sfa-th"><span className="sfa-rank">rank</span><span className="sfa-idx">start</span><span>sorted suffix</span></div>
        {suffixes.map((suf, rank) => {
          const inRange = pat && rank >= res.lo && rank < res.hi && res.positions.includes(sa[rank]);
          return (
            <div key={rank} className={`sfa-row ${inRange ? 'on' : ''}`}>
              <span className="sfa-rank">{rank}</span>
              <span className="sfa-idx">{sa[rank]}</span>
              <span className="sfa-suf">{pat && suf.startsWith(pat) ? <><b>{suf.slice(0, pat.length)}</b>{suf.slice(pat.length)}</> : suf}</span>
            </div>
          );
        })}
      </div>
      {pat && res.positions.length > 0 && <div className="sfa-note">all suffixes starting with “{pat}” form rows {res.lo}–{res.hi - 1} — one contiguous block, found by two binary searches.</div>}

      <p className="sfa-foot">
        Sorting the suffixes is the whole trick: any pattern’s matches are exactly the suffixes that have it as a prefix, and those sit next to
        each other, so two binary searches bracket the block in <strong>O(m log n)</strong> — no scanning the text. The array is just n integers
        (far smaller than a suffix tree) and, paired with an <strong>LCP array</strong> (longest common prefix between adjacent suffixes), answers
        longest-repeated-substring, distinct-substring counts, and more. It’s how genome aligners and full-text indexes search billions of
        characters, and it’s the same sorted-rotations idea as the <strong>Burrows-Wheeler transform</strong> (the BWT is the character just before
        each sorted suffix). Building it fast (O(n) DC3, or O(n log n) prefix-doubling) is its own small art. (Manber &amp; Myers, 1990.)
      </p>
    </div>
  );
}
