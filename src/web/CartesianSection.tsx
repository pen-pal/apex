// The Cartesian tree, made visible. An array is drawn as bars and as a tree whose root is the array minimum and
// which is a min-heap by value / BST by index. Pick a range [i, j] and watch the range's minimum light up as the
// LOWEST COMMON ANCESTOR of positions i and j — the RMQ = LCA equivalence, live. Real model from cartesian.ts.
import { useMemo, useState } from 'react';
import { build, lca, type Tree } from './cartesian';

const PRESETS: Record<string, number[]> = {
  default: [9, 3, 7, 1, 8, 2, 6, 5, 4],
  ascending: [1, 2, 3, 4, 5, 6, 7, 8],
  valley: [8, 5, 3, 1, 2, 4, 7, 9],
};

function nodeDepths(t: Tree): number[] {
  const d = new Array(t.nodes.length).fill(0);
  const visit = (x: number, dep: number) => { if (x < 0) return; d[x] = dep; visit(t.nodes[x].left, dep + 1); visit(t.nodes[x].right, dep + 1); };
  visit(t.root, 0);
  return d;
}

export function CartesianSection() {
  const [a, setA] = useState<number[]>(PRESETS.default);
  const [i, setI] = useState(2);
  const [j, setJ] = useState(7);

  const t = useMemo(() => build(a), [a]);
  const depth = useMemo(() => nodeDepths(t), [t]);
  const lo = Math.min(i, j), hi = Math.max(i, j);
  const anc = lca(t, lo, hi);
  const maxVal = Math.max(...a), maxDepth = Math.max(...depth);

  const W = 620, H = 240, PT = 22, PB = 16, PL = 16, PR = 16;
  const nx = (idx: number) => PL + (idx + 0.5) * (W - PL - PR) / a.length;
  const ny = (dep: number) => PT + dep * ((H - PT - PB) / Math.max(1, maxDepth));

  const shuffle = () => {
    let s = (a.reduce((x, y) => x + y, 0) * 131 + 17) & 0x7fffffff;
    const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s; };
    const arr = a.map((_, k) => k + 1); for (let k = arr.length - 1; k > 0; k--) { const r = rnd() % (k + 1); [arr[k], arr[r]] = [arr[r], arr[k]]; }
    setA(arr); setI(0); setJ(arr.length - 1);
  };

  return (
    <div className="crt">
      <p className="crt-intro">
        The <strong>Cartesian tree</strong> of an array: the root is the array's <strong>minimum</strong>, and
        each subtree is the Cartesian tree of one side. It's a <strong>min-heap</strong> by value and a
        <strong> BST</strong> by index (in-order gives back the array). The minimum of any range
        <code> a[i..j]</code> is the <strong>lowest common ancestor</strong> of positions i and j — so
        range-minimum and LCA are the same problem. Drag the range:
      </p>

      <div className="crt-presets">
        {Object.keys(PRESETS).map((k) => <button key={k} type="button" className={`crt-preset ${a === PRESETS[k] ? 'on' : ''}`} onClick={() => { setA(PRESETS[k]); setI(0); setJ(PRESETS[k].length - 1); }}>{k}</button>)}
        <button type="button" className="crt-preset" onClick={shuffle}>🎲 shuffle</button>
      </div>

      <div className="crt-range">
        <label>i = <b>{lo}</b><input type="range" min={0} max={a.length - 1} value={i} onChange={(e) => setI(+e.target.value)} /></label>
        <label>j = <b>{hi}</b><input type="range" min={0} max={a.length - 1} value={j} onChange={(e) => setJ(+e.target.value)} /></label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="crt-tree">
        {t.nodes.map((n) => n.parent >= 0 && (
          <line key={`e${n.i}`} x1={nx(n.i)} y1={ny(depth[n.i])} x2={nx(n.parent)} y2={ny(depth[n.parent])} className="crt-edge" />
        ))}
        {t.nodes.map((n) => {
          const inRange = n.i >= lo && n.i <= hi;
          const isLca = n.i === anc;
          return (
            <g key={n.i}>
              <circle cx={nx(n.i)} cy={ny(depth[n.i])} r={13} className={`crt-node ${isLca ? 'lca' : inRange ? 'inr' : ''}`} />
              <text x={nx(n.i)} y={ny(depth[n.i]) + 4} className="crt-nv" textAnchor="middle">{n.val}</text>
            </g>
          );
        })}
      </svg>

      <div className="crt-bars">
        {a.map((v, idx) => (
          <div key={idx} className={`crt-barwrap ${idx >= lo && idx <= hi ? 'inr' : ''} ${idx === anc ? 'min' : ''}`}>
            <div className="crt-bar" style={{ height: `${(v / maxVal) * 46 + 8}px` }} />
            <span className="crt-bi">{idx}</span>
          </div>
        ))}
      </div>

      <div className="crt-verdict">
        min of <code>a[{lo}..{hi}]</code> = <b>{a[anc]}</b> at position <b>{anc}</b> — the LCA of nodes {lo} and {hi}.
      </div>

      <p className="crt-foot">
        Why this matters: RMQ and LCA look unrelated, but the Cartesian tree shows they're interchangeable, and
        that unlocks the fast algorithms for both. Turn an RMQ into an LCA (build the Cartesian tree, O(n)), then
        turn the LCA into an RMQ again — but on the tree's <strong>Euler tour</strong>, where consecutive depths
        differ by exactly ±1. That special <em>±1 RMQ</em> can be preprocessed in O(n) for O(1) queries (the
        Four-Russians / sparse-table hybrid), giving the celebrated O(n)-build, O(1)-query range minimum. The
        same tree is the bridge to the <strong>treap</strong>: take (key, random priority) pairs, and the
        Cartesian tree ordered by key-as-BST and priority-as-heap is a balanced BST with high probability — the
        heap on random priorities is what keeps it balanced. Cartesian trees also appear in suffix-tree
        construction and in the LCA-based longest-common-extension queries that power fast string matching. The
        construction itself is a lovely example of amortized analysis: the monotonic stack does O(n) total work
        because each element is pushed once and popped once, even though a single step may pop many — the same
        accounting behind the <em>largest rectangle in a histogram</em> and <em>next greater element</em>, which
        are Cartesian-tree problems in disguise. (Vuillemin, 1980; Gabow, Bentley &amp; Tarjan, 1984.)
      </p>
    </div>
  );
}
