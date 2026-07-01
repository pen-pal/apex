// Longest Increasing Subsequence via patience sorting, made visible. The array is dealt into piles like
// solitaire — each card goes on the leftmost pile whose top is ≥ it — and the number of piles equals the LIS
// length. Each array cell is tinted by the pile it lands on; the reconstructed LIS is ringed. Real model from
// lis.ts.
import { useMemo, useState } from 'react';
import { lis } from './lis';

const PRESETS: Record<string, number[]> = {
  default: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
  shuffled: [6, 3, 5, 1, 9, 4, 2, 8, 7],
  increasing: [1, 2, 3, 4, 5, 6],
};
const PILE_HUES = [212, 150, 28, 280, 340, 90, 190, 50];
const hue = (k: number) => PILE_HUES[k % PILE_HUES.length];

export function LisSection() {
  const [a, setA] = useState<number[]>(PRESETS.default);
  const r = useMemo(() => lis(a), [a]);
  const inLis = useMemo(() => new Set(r.indices), [r]);

  const piles = useMemo(() => {
    const cols: number[][] = Array.from({ length: r.length }, () => []);
    a.forEach((v, i) => cols[r.pile[i]].push(v));
    return cols;
  }, [a, r]);

  const shuffle = () => {
    let s = (a.reduce((x, y) => x + y, 0) * 131 + 29) & 0x7fffffff;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s; };
    const arr = Array.from({ length: 9 }, () => rnd() % 20);
    setA(arr);
  };

  return (
    <div className="lis">
      <p className="lis-intro">
        The <strong>longest increasing subsequence</strong> is the longest run of values that rise left to right
        (not necessarily adjacent). Patience sorting finds it in O(n log n): deal the numbers like solitaire —
        each card lands on the <strong>leftmost pile whose top is ≥ it</strong> (a binary search), or starts a new
        pile. The <strong>number of piles equals the LIS length</strong>. Pick an array:
      </p>

      <div className="lis-presets">
        {Object.keys(PRESETS).map((k) => <button key={k} type="button" className={`lis-preset ${a === PRESETS[k] ? 'on' : ''}`} onClick={() => setA(PRESETS[k])}>{k}</button>)}
        <button type="button" className="lis-preset" onClick={shuffle}>🎲 shuffle</button>
      </div>

      <div className="lis-arr">
        {a.map((v, i) => (
          <div key={i} className={`lis-cell ${inLis.has(i) ? 'inlis' : ''}`} style={{ background: `hsl(${hue(r.pile[i])} 55% 50% / .18)`, borderColor: `hsl(${hue(r.pile[i])} 55% 50% / .5)` }}>
            <span className="lis-v">{v}</span>
            <span className="lis-p">pile {r.pile[i]}</span>
          </div>
        ))}
      </div>

      <div className="lis-piles">
        {piles.map((col, k) => (
          <div key={k} className="lis-pile">
            <div className="lis-pilehead" style={{ color: `hsl(${hue(k)} 55% 45%)` }}>pile {k}</div>
            {col.map((v, j) => (
              <div key={j} className="lis-card" style={{ background: `hsl(${hue(k)} 55% 50% / ${j === col.length - 1 ? .3 : .12})`, borderColor: `hsl(${hue(k)} 55% 50% / .5)` }}>{v}</div>
            ))}
          </div>
        ))}
      </div>

      <div className="lis-verdict">
        <b>{piles.length}</b> piles → LIS length <b>{r.length}</b>: <span className="lis-seq">{r.sequence.join(' → ')}</span>
      </div>

      <p className="lis-foot">
        Why the pile count is the answer: within a pile, cards go top-to-bottom in <em>decreasing</em> order (a new
        card only lands on a pile whose top is ≥ it), and across piles the tops are <em>increasing</em>. So any
        increasing subsequence can pick at most one card per pile → the LIS is at most the number of piles; and
        following the "predecessor = top of the pile to my left" back-pointers builds an increasing subsequence
        that hits every pile → it's at least that long. Equality, and an O(n log n) algorithm, fall out of one
        greedy rule. The same <code>tails</code> array powers a family of tricks: patience sorting is literally a
        card game analyzed by Aldous and Diaconis, whose deep result connects the expected LIS of a random
        permutation (~2√n) to random-matrix theory. LIS underlies <strong>box/envelope stacking</strong>, the
        <em> patience diff</em> algorithm Git can use (align two files by their longest common increasing run of
        matching lines), and airplane-boarding and scheduling problems. Swap the comparison to non-strict for the
        longest non-decreasing run, or run it on the reversed/negated array for the longest decreasing one; run
        LIS on one sequence's positions within another and you get the longest common subsequence of a permutation
        in O(n log n) instead of O(n²). It's a small algorithm with a surprisingly long reach. (Schensted, 1961;
        Aldous &amp; Diaconis, 1999.)
      </p>
    </div>
  );
}
