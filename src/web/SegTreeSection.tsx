// Segment tree, made visible. The array sits at the leaves; above it, each node shows the
// minimum of its range. Drag the query range and the O(log n) nodes that cover it light up,
// combining into the answer; click a leaf to update it and watch the change ripple up to the
// root. Real range-min segment tree in segtree.ts (tested against brute force).
import { useMemo, useState } from 'react';
import { build, queryMin, update, buildLazy, rangeAdd, toArray, type SegTree, type LazyTree } from './segtree';

const INIT = [5, 2, 8, 1, 9, 3, 7, 4];

function clone(s: SegTree): SegTree { return { n: s.n, tree: [...s.tree] }; }
function cloneLazy(t: LazyTree): LazyTree { return { n: t.n, min: [...t.min], lazy: [...t.lazy] }; }

export function SegTreeSection() {
  const [tree, setTree] = useState<SegTree>(() => build(INIT));
  const [vals, setVals] = useState<number[]>(INIT);
  const [l, setL] = useState(2);
  const [r, setR] = useState(5);

  const lo = Math.min(l, r), hi = Math.max(l, r);
  const q = useMemo(() => queryMin(tree, lo, hi), [tree, lo, hi]);
  const qNodes = new Set(q.nodes);

  // lazy-propagation demo: a second tree that supports range-add over the same [lo, hi]
  const [lazy, setLazy] = useState<LazyTree>(() => buildLazy(INIT));
  const [delta, setDelta] = useState(3);
  const [tagged, setTagged] = useState<number[]>([]);
  const lazyVals = useMemo(() => toArray(cloneLazy(lazy)), [lazy]); // clone so render never mutates state
  const lazyMin = lazyVals.length ? Math.min(...lazyVals.slice(lo, hi + 1)) : Infinity;
  const applyRange = () => { const c = cloneLazy(lazy); setTagged(rangeAdd(c, lo, hi, delta)); setLazy(c); };
  const resetLazy = () => { setLazy(buildLazy(INIT)); setTagged([]); };

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

        <div className="seg-lazy">
          <div className="seg-lazy-head">
            <h3>Lazy propagation — update a whole range at once</h3>
            <div className="seg-lazy-ctrl">
              <button onClick={() => setDelta((d) => d - 1)}>−</button>
              <span className="seg-delta">+{delta}</span>
              <button onClick={() => setDelta((d) => d + 1)}>+</button>
              <button className="seg-apply" onClick={applyRange}>add {delta >= 0 ? `+${delta}` : delta} to [{lo}…{hi}]</button>
              <button className="seg-lazy-reset" onClick={resetLazy}>reset</button>
            </div>
          </div>
          <div className="seg-array lazy">
            {lazyVals.map((v, i) => (
              <div key={i} className={`seg-cell ${i >= lo && i <= hi ? 'inrange' : ''}`}>
                <span className="seg-idx">{i}</span>
                <span className="seg-val">{v}</span>
              </div>
            ))}
          </div>
          <p className="seg-lazy-note">
            That range-add touched only <b>{tagged.length || '—'}</b> {tagged.length === 1 ? 'node' : 'nodes'}
            {tagged.length ? ` (ids ${tagged.join(', ')})` : ''} — not the {hi - lo + 1} element{hi - lo + 1 === 1 ? '' : 's'} it covers.
            Each fully-covered node just banks the +{delta} as a lazy tag; the tag is pushed down to children only when a later query or
            update needs to descend through it. min[{lo}…{hi}] is now <b>{lazyMin === Infinity ? '∞' : lazyMin}</b>.
          </p>
        </div>

        <p className="seg-foot">
          The merge step is the key: as long as your operation is <em>associative</em> — min, max, sum, gcd, matrix product — a parent can
          be combined from its children, so the same tree answers that query type in O(log n). <strong>Lazy propagation</strong> (above) extends
          that to whole-range updates by deferring work to children only when they’re next visited. Segment trees underpin range-analytics,
          interval scheduling, and a lot of competitive programming; the simpler Fenwick tree wins when you only need prefix sums.
        </p>
      </section>
    </div>
  );
}
