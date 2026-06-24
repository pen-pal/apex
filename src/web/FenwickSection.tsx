// Fenwick tree, made visible. The array sits on top; below it, each tree node is drawn as
// a bar spanning the block of elements it sums (length = its lowest set bit). Hover/select
// a prefix-sum query and the ~log n nodes it descends through light up; pick an element to
// update and the climbing path lights up. Real BIT in fenwick.ts (tested).
import { useMemo, useState } from 'react';
import { build, update, query, responsibility, type Fenwick } from './fenwick';

const A0 = [3, 2, -1, 6, 5, 4, -3, 3];

function clone(f: Fenwick): Fenwick { return { n: f.n, tree: [...f.tree] }; }

export function FenwickSection() {
  const [vals, setVals] = useState<number[]>(A0);
  const f = useMemo(() => build(vals), [vals]);
  const [q, setQ] = useState(7);
  const [u, setU] = useState(5);

  const qr = useMemo(() => query(f, q), [f, q]);
  const upPath = useMemo(() => { const c = clone(f); return update(c, u, 0); }, [f, u]);
  const qSet = new Set(qr.visited);
  const uSet = new Set(upPath);

  const bump = (i: number, d: number) => setVals((v) => v.map((x, k) => (k === i ? x + d : x)));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Fenwick tree — prefix sums in O(log n)</h2></div>
        <p className="jsec-sub">
          A plain array makes element updates O(1) but prefix sums O(n); a Fenwick tree balances both to O(log n) using a binary trick:
          node <code>i</code> stores the sum of a block ending at <code>i</code> whose length is <code>i</code>’s lowest set bit
          (<code>i &amp; −i</code>). A prefix sum walks down by stripping that bit; an update climbs up by adding it — touching one node per
          set bit.
        </p>

        <div className="fen-array">
          {vals.map((v, i) => (
            <div key={i} className="fen-cell">
              <span className="fen-idx">{i + 1}</span>
              <span className="fen-val">{v}</span>
              <div className="fen-bump"><button onClick={() => bump(i, 1)}>+</button><button onClick={() => bump(i, -1)}>−</button></div>
            </div>
          ))}
        </div>

        <div className="fen-tree">
          {Array.from({ length: f.n }, (_, k) => k + 1).map((i) => {
            const [lo, hi] = responsibility(i);
            return (
              <div key={i} className={`fen-node ${qSet.has(i) ? 'q' : ''} ${uSet.has(i) ? 'u' : ''}`}
                style={{ marginLeft: `${(lo - 1) * 44}px`, width: `${(hi - lo + 1) * 44 - 6}px` }}>
                <span className="fen-nlabel">tree[{i}]</span>
                <span className="fen-nrange">Σ{lo}…{hi} = {f.tree[i]}</span>
              </div>
            );
          })}
        </div>

        <div className="fen-ops">
          <div className="fen-op">
            <label>prefix sum query(<select value={q} onChange={(e) => setQ(+e.target.value)}>{Array.from({ length: f.n }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>)</label>
            <span className="fen-result q">= {qr.sum} <em>via {qr.visited.join(' → ')}</em></span>
          </div>
          <div className="fen-op">
            <label>update element <select value={u} onChange={(e) => setU(+e.target.value)}>{Array.from({ length: f.n }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
            <span className="fen-result u">climbs {upPath.join(' → ')}</span>
          </div>
        </div>

        <p className="fen-foot">
          Read the lowest-set-bit magic: query(7) descends <code>7 → 6 → 4</code> (binary 111 → 110 → 100, stripping one bit at a time),
          and updating element 5 climbs <code>5 → 6 → 8</code> (101 → 110 → 1000) — each is one step per bit, so ~log n. The same tree,
          built over a frequency array, answers “how many values are ≤ x” for order statistics, and a second BIT gives range-update /
          range-query. It’s a tiny, cache-friendly alternative to a segment tree when you only need sums.
        </p>
      </section>
    </div>
  );
}
