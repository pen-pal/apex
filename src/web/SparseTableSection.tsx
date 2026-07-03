// Sparse table, made visible. The array on top; below it the precomputed table, one row per power-of-two block
// length, each cell holding the minimum of its block. Drag the query range and watch it get covered by exactly
// TWO blocks — one anchored at the left end, one at the right — that overlap in the middle (fine, because min is
// idempotent). The answer is one min of two lookups, no matter how wide the range. Real model from
// sparsetable.ts.
import { useMemo, useState } from 'react';
import { build, query } from './sparsetable';

const INIT = [5, 2, 8, 1, 9, 3, 7, 4, 6, 0, 5, 3];

export function SparseTableSection() {
  const [arr, setArr] = useState<number[]>(INIT);
  const [l, setL] = useState(2);
  const [r, setR] = useState(8); // width 7 → two distinct overlapping length-4 blocks

  const table = useMemo(() => build(arr), [arr]);
  const n = arr.length;
  const lo = Math.min(l, r), hi = Math.max(l, r);
  const q = query(table, lo, hi);
  const k = q.k, len = 1 << k;
  const [b1, b2] = q.blocks;                 // block starts
  const b1Range = [b1, b1 + len - 1], b2Range = [b2, b2 + len - 1];
  const inB1 = (i: number) => i >= b1Range[0] && i <= b1Range[1];
  const inB2 = (i: number) => i >= b2Range[0] && i <= b2Range[1];

  const randomize = () => {
    let s = (arr.reduce((a, b) => a + b, 0) * 131 + 7) & 0x7fffffff;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % 20; };
    setArr(Array.from({ length: 12 }, rnd)); setL(2); setR(8);
  };

  return (
    <div className="spt">
      <p className="spt-intro">
        For a <em>static</em> array, you can answer any range-minimum query in <strong>O(1)</strong> — two
        lookups and a <code>min</code> — after an O(n log n) precompute. <code>Min</code> is
        <strong> idempotent</strong> (min(x,x)=x), so a query [l, r] can be covered by two overlapping
        power-of-two blocks and the double-counted middle does no harm. Drag the range:
      </p>

      <div className="spt-controls">
        <label>l <input type="range" min={0} max={n - 1} value={l} onChange={(e) => setL(+e.target.value)} /><b>{lo}</b></label>
        <label>r <input type="range" min={0} max={n - 1} value={r} onChange={(e) => setR(+e.target.value)} /><b>{hi}</b></label>
        <button type="button" className="spt-rand" onClick={randomize}>🎲 randomize</button>
      </div>

      {/* the array */}
      <div className="spt-arr">
        {arr.map((v, i) => {
          const inQ = i >= lo && i <= hi;
          const both = inB1(i) && inB2(i);
          return (
            <div key={i} className={`spt-cell ${inQ ? 'inq' : ''} ${inB1(i) ? 'b1' : ''} ${inB2(i) ? 'b2' : ''} ${both ? 'both' : ''} ${v === q.value && inQ ? 'minv' : ''}`}>
              <span className="spt-v">{v}</span><span className="spt-i">{i}</span>
            </div>
          );
        })}
      </div>

      {/* the sparse table */}
      <div className="spt-table">
        {table.map((row, kk) => (
          <div key={kk} className="spt-row">
            <span className="spt-rlabel">len {1 << kk}</span>
            <div className="spt-rcells">
              {arr.map((_, i) => {
                const has = i < row.length;
                const isUsed = kk === k && (i === b1 || i === b2);
                return <div key={i} className={`spt-tcell ${has ? '' : 'empty'} ${isUsed ? 'used' : ''}`}>{has ? row[i] : ''}</div>;
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="spt-result">
        query <b>[{lo}, {hi}]</b> (width {hi - lo + 1}) → k={k}, cover with two length-{len} blocks
        <span className="spt-blk b1">[{b1Range[0]}‥{b1Range[1]}]={table[k][b1]}</span> and
        <span className="spt-blk b2">[{b2Range[0]}‥{b2Range[1]}]={table[k][b2]}</span> →
        min = <b className="spt-ans">{q.value}</b> <i>· 2 lookups, O(1)</i>
      </div>

      <p className="spt-foot">
        The idempotency requirement is the whole story: this two-overlapping-blocks trick works for
        <strong> min, max, gcd, and bitwise AND/OR</strong> — operations where processing an element twice
        changes nothing. It does <em>not</em> work for <strong>sum</strong> (the overlap would be counted twice);
        for sum you either use a different sparse-table split into <em>disjoint</em> blocks (O(log n) query) or a
        prefix-sum array (O(1) but only for sum) or a Fenwick/segment tree. And the limitation that sends people to a
        segment tree is <strong>updates</strong>: a sparse table is baked at build time — change one element and
        you must rebuild the affected columns, so it's for read-mostly data. Where it shines is exactly that:
        an immutable array queried a huge number of times — a precomputed terrain or cost map, an LCA structure
        (range-min over an Euler tour answers lowest-common-ancestor), or read-only analytics over a column. It's
        also the launch point for O(n)-build constant-query RMQ (the Bender–Farach-Colton method that blocks the
        array and sparse-tables the block minima). (Bender &amp; Farach-Colton, 2000.)
      </p>
    </div>
  );
}
