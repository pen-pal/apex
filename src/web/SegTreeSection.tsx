// Segment tree, made visible. The array sits at the leaves; above it, each node shows the
// minimum of its range. Drag the query range and the O(log n) nodes that cover it light up,
// combining into the answer; click a leaf to update it and watch the change ripple up to the
// root. Real range-min segment tree in segtree.ts (tested against brute force).
import { useMemo, useState } from 'react';
import { build, queryMin, update, type SegTree } from './segtree';

const INIT = [5, 2, 8, 1, 9, 3, 7, 4];

function clone(s: SegTree): SegTree { return { n: s.n, tree: [...s.tree] }; }

export function SegTreeSection() {
  const [tree, setTree] = useState<SegTree>(() => build(INIT));
  const [vals, setVals] = useState<number[]>(INIT);
  const [l, setL] = useState(2);
  const [r, setR] = useState(5);

  const q = useMemo(() => queryMin(tree, Math.min(l, r), Math.max(l, r)), [tree, l, r]);
  const qNodes = new Set(q.nodes);

  const bump = (i: number, d: number) => {
    const nv = vals.map((x, k) => (k === i ? x + d : x));
    setVals(nv); const s = clone(tree); update(s, i, nv[i]); setTree(s);
  };

  // levels of the implicit tree (index 1 = root, then 2..3, 4..7, …)
  const levels = useMemo(() => {
    const out: number[][] = [];
    let lvl = 1;
    while (lvl < 2 * tree.n) { const row: number[] = []; for (let i = lvl; i < Math.min(lvl * 2, 2 * tree.n); i++) row.push(i); out.push(row); lvl *= 2; }
    return out;
  }, [tree]);
  const fmt = (v: number) => (v === Infinity ? '∞' : v);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Segment tree — range queries in O(log n)</h2></div>
        <p className="jsec-sub">
          Each node holds the minimum of a slice of the array; the root covers everything, its children each half, and so on down to the
          leaves. A range query grabs the few nodes that exactly tile the range — never more than ~2·log n — and combines them. Unlike a
          Fenwick tree (sums only), this works for min, max, gcd… anything associative.
        </p>

        <div className="seg-range">
          <label>range start <input type="range" min={0} max={INIT.length - 1} value={l} onChange={(e) => setL(+e.target.value)} /><b>{Math.min(l, r)}</b></label>
          <label>range end <input type="range" min={0} max={INIT.length - 1} value={r} onChange={(e) => setR(+e.target.value)} /><b>{Math.max(l, r)}</b></label>
          <span className="seg-answer">min[{Math.min(l, r)}…{Math.max(l, r)}] = <b>{fmt(q.min)}</b></span>
        </div>

        <div className="seg-tree">
          {levels.map((row, li) => (
            <div key={li} className="seg-level">
              {row.map((idx) => (
                <div key={idx} className={`seg-node ${qNodes.has(idx) ? 'q' : ''} ${idx >= tree.n ? 'leaf' : ''}`}>{fmt(tree.tree[idx])}</div>
              ))}
            </div>
          ))}
        </div>

        <div className="seg-array">
          {vals.map((v, i) => (
            <div key={i} className={`seg-cell ${i >= Math.min(l, r) && i <= Math.max(l, r) ? 'inrange' : ''}`}>
              <span className="seg-idx">{i}</span>
              <span className="seg-val">{v}</span>
              <div className="seg-bump"><button onClick={() => bump(i, 1)}>+</button><button onClick={() => bump(i, -1)}>−</button></div>
            </div>
          ))}
        </div>

        <p className="seg-foot">
          The merge step is the key: as long as your operation is <em>associative</em> — min, max, sum, gcd, matrix product — a parent can
          be combined from its children, so the same tree answers that query type in O(log n). Add <strong>lazy propagation</strong> and a
          single call can update a whole range (e.g. “add 5 to [l,r]”) by deferring the work to children only when they’re next visited.
          Segment trees underpin range-analytics, interval scheduling, and a lot of competitive programming; the simpler Fenwick tree wins
          when you only need prefix sums.
        </p>
      </section>
    </div>
  );
}
