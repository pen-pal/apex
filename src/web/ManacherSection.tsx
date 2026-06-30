// Manacher's algorithm, made visible. Type a string; it's interleaved with # so every palindrome is
// odd-length, then each position gets a radius P[i] — how far a palindrome centered there reaches. The
// tallest bar is the answer. The win is the comparison count: Manacher does ~O(n) character comparisons
// where expand-around-center does O(n²), because the mirror symmetry lets it reuse radii it already knows.
// Real model from manacher.ts.
import { useMemo, useState } from 'react';
import { manacher } from './manacher';

export function ManacherSection() {
  const [s, setS] = useState('forgeeksskeegfor');
  const m = useMemo(() => manacher(s), [s]);
  const ci = m.radii.indexOf(m.length);
  const lo = ci - m.length, hi = ci + m.length; // palindrome span in transformed coords
  const maxR = Math.max(1, ...m.radii);
  const bruteCmp = s.length === 0 ? 0 : s.length * s.length; // ~O(n^2) expand-around-center upper bound

  return (
    <div className="man">
      <p className="man-intro">
        The <strong>longest palindromic substring</strong> in <strong>O(n)</strong>. Interleave separators
        (<code>#a#b#a#</code>) so even and odd palindromes look the same, then give every position a
        <strong> radius</strong>. Mirror symmetry means positions inside a known palindrome inherit their
        radius for free — so new character comparisons only ever push the frontier right. Linear, not
        quadratic.
      </p>

      <label className="man-input">string
        <input value={s} onChange={(e) => setS(e.target.value.slice(0, 28))} spellCheck={false} />
      </label>

      <div className="man-result">
        longest palindrome: <code className="man-pal">{m.longest || '—'}</code>
        <span className="man-meta">length {m.length} · at index {m.length ? m.start : '—'}</span>
      </div>

      {/* original string with the palindrome highlighted */}
      <div className="man-orig">
        {[...s].map((ch, j) => (
          <span key={j} className={`man-och ${m.length && j >= m.start && j < m.start + m.length ? 'in' : ''}`}>{ch}</span>
        ))}
        {s.length === 0 && <span className="man-empty">type something…</span>}
      </div>

      {/* transformed string: per-center radius bars */}
      <div className="man-trans">
        <div className="man-trans-h">transformed &amp; per-center radius P[i]:</div>
        <div className="man-bars">
          {[...m.transformed].map((ch, i) => {
            const inPal = i >= lo && i <= hi;
            return (
              <div key={i} className={`man-col ${i === ci ? 'center' : ''} ${inPal ? 'span' : ''}`}>
                <div className="man-bar-wrap"><div className="man-bar" style={{ height: `${(m.radii[i] / maxR) * 100}%` }} /></div>
                <span className="man-r">{m.radii[i]}</span>
                <span className={`man-ch ${ch === '#' ? 'sep' : ''}`}>{ch}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="man-tally">
        <div className="man-stat ok"><span>Manacher comparisons</span><b>{m.comparisons}</b></div>
        <div className="man-stat bad"><span>expand-around-center (~n²)</span><b>≤ {bruteCmp}</b></div>
        <div className="man-stat"><span>speedup</span><b>{m.comparisons ? `${(bruteCmp / m.comparisons).toFixed(1)}×` : '—'}</b></div>
      </div>

      <p className="man-foot">
        The state is one window <code>[center − right, center + right]</code> — the palindrome that reaches
        furthest right so far. For a new position <code>i</code> inside it, its mirror <code>2·center − i</code>
        has already been measured, so <code>P[i]</code> starts at <code>min(right − i, P[mirror])</code> and
        only needs to try growing <em>beyond</em> the boundary. Because <code>right</code> never moves
        backward, the total growth work is bounded by <code>n</code> → <strong>O(n)</strong>. Palindromes show
        up in DNA (reverse-complement repeats), text diffing, and as a classic interview problem; the same
        center-reuse idea underlies the Z-algorithm and palindromic trees (eertree). (Manacher, 1975.)
      </p>
    </div>
  );
}
