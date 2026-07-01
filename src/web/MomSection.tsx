// Median of medians, made visible. The array is split into groups of 5; each group's median is highlighted, the
// medians are collected, and their median becomes the pivot. The balance bar shows the guarantee: the pivot is
// greater than ~30% of elements and less than ~30%, so it can never land in the extreme tails and every
// partition throws away a constant fraction — hence linear-time selection. Real model from medianofmedians.ts.
import { useMemo, useState } from 'react';
import { analyze, select } from './medianofmedians';

const med5 = (g: number[]) => [...g].sort((a, b) => a - b)[Math.floor(g.length / 2)];

export function MomSection() {
  const [arr, setArr] = useState<number[]>([37, 12, 88, 5, 61, 24, 73, 9, 50, 41, 96, 18, 66, 33, 80, 2, 55, 29, 71, 44, 14, 83, 7, 60]);

  const an = useMemo(() => analyze(arr), [arr]);
  const sortedGroups = an.groups.map((g) => [...g].sort((a, b) => a - b));
  const pct = (n: number) => (n / an.n) * 100;

  const randomize = () => {
    let s = (arr.reduce((a, b) => a + b, 0) * 131 + 7) & 0x7fffffff;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % 100; };
    const set = new Set<number>(); while (set.size < 24) set.add(rnd());
    setArr([...set]);
  };

  return (
    <div className="mom">
      <p className="mom-intro">
        Quickselect finds the k-th smallest fast on average but can degrade to O(n²) with bad pivots. Median of
        medians picks a provably good pivot: split into <strong>groups of 5</strong>, take each group's
        <strong> median</strong>, then recursively take the <strong>median of those medians</strong>. That pivot
        can't be in the extreme tails, so every partition is balanced — guaranteed linear time.
      </p>

      <div className="mom-controls"><span>{an.n} elements → {an.groups.length} groups of 5</span><button type="button" className="mom-rand" onClick={randomize}>🎲 shuffle</button></div>

      <div className="mom-groups">
        {sortedGroups.map((g, gi) => (
          <div key={gi} className="mom-group">
            {g.map((v, i) => {
              const isMed = v === med5(g) && i === Math.floor(g.length / 2);
              return <span key={i} className={`mom-cell ${isMed ? 'median' : ''} ${v === an.pivot ? 'pivot' : ''}`}>{v}</span>;
            })}
          </div>
        ))}
      </div>

      <div className="mom-medrow">
        <span className="mom-lbl">group medians →</span>
        {an.medians.map((m, i) => <span key={i} className={`mom-cell med ${m === an.pivot ? 'pivot' : ''}`}>{m}</span>)}
        <span className="mom-arrow">median of medians = <b>{an.pivot}</b></span>
      </div>

      <div className="mom-balance">
        <div className="mom-bal-h">partition around pivot <b>{an.pivot}</b>:</div>
        <div className="mom-bar">
          <div className="mom-seg less" style={{ width: `${pct(an.less)}%` }}>{an.less} &lt;</div>
          {an.equal > 0 && <div className="mom-seg eq" style={{ width: `${pct(an.equal)}%` }}>{an.equal}=</div>}
          <div className="mom-seg gt" style={{ width: `${pct(an.greater)}%` }}>{an.greater} &gt;</div>
        </div>
        <div className="mom-guarantee">
          {Math.round(pct(an.less))}% below and {Math.round(pct(an.greater))}% above — the pivot is
          <strong> never in the extreme ~30% tails</strong>, so the larger side is at most ~70% and the recursion
          shrinks by a constant fraction each step: T(n) = T(n/5) + T(7n/10) + O(n) = <b>O(n)</b>.
        </div>
      </div>

      <div className="mom-select">
        the pivot is the {an.less + 1}-th smallest overall; using it, <code>select</code> finds any k-th element —
        e.g. the median (k={Math.floor(an.n / 2)}) is <b>{select(arr, Math.floor(an.n / 2))}</b>.
      </div>

      <p className="mom-foot">
        The proof is the payoff. There are ⌈n/5⌉ group medians; the pivot is their median, so it's ≥ half of them
        (⌈n/10⌉ medians), and each of those medians is itself ≥ 3 elements of its group of 5 — so the pivot is ≥
        roughly 3n/10 elements, and symmetrically ≤ 3n/10. That's why neither side of the partition can exceed
        ~7n/10, which makes the recursion linear. Finding the pivot costs a recursive select on n/5 medians —
        small enough that T(n/5) + T(7n/10) {'<'} T(n), the whole reason the groups are 5 (with 3 the two terms
        sum to ≥ n and it's no longer linear). In practice the constant hidden in that O(n) is large, so production
        code doesn't use pure median-of-medians: randomized quickselect is faster in expectation, and
        <strong> introselect</strong> (used by C++'s <code>nth_element</code>) runs quickselect but falls back to
        median-of-medians only if it detects too many bad pivots — getting the average-case speed with the
        worst-case guarantee. The deeper lesson is the technique: when a greedy choice can be sabotaged, spend a
        sublinear amount of work computing a <em>summary</em> (here, medians of medians) to make a provably good
        choice — the same shape as pivoting, sampling, and sketch-guided decisions elsewhere. (Blum, Floyd,
        Pratt, Rivest &amp; Tarjan, 1973.)
      </p>
    </div>
  );
}
