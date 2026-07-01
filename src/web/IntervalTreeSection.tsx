// Interval tree, made visible. A set of intervals on a number line and a query range you can slide. The tree
// below is a BST keyed by each interval's low endpoint, and every node is labelled with its subtree's MAX high
// endpoint — the number that lets a search prune whole subtrees that can't possibly reach the query. Overlaps
// light up green on the line and in the tree; subtrees pruned by the max show dimmed. Real model from
// intervaltree.ts.
import { useMemo, useState } from 'react';
import { build, search, type Interval, type Node } from './intervaltree';

const INTERVALS: Interval[] = [[1, 5], [3, 8], [6, 10], [9, 14], [12, 15], [16, 22], [18, 20], [24, 28]]; // number-line order
// insert in a branchy order (same set) so the BST actually forks instead of degenerating into a chain
const INSERT: Interval[] = [[9, 14], [3, 8], [18, 20], [1, 5], [6, 10], [12, 15], [24, 28], [16, 22]];
const MINV = 0, MAXV = 30;

export function IntervalTreeSection() {
  const [qLo, setQLo] = useState(7);
  const [qHi, setQHi] = useState(13);
  const root = useMemo(() => build(INSERT), []);
  const res = useMemo(() => search(root, Math.min(qLo, qHi), Math.max(qLo, qHi)), [root, qLo, qHi]);
  const hitSet = new Set(res.hits.map(([lo, hi]) => `${lo},${hi}`));
  const q = [Math.min(qLo, qHi), Math.max(qLo, qHi)] as const;

  // tree layout: in-order x, depth y
  const pos = useMemo(() => {
    const p = new Map<Node, { x: number; d: number }>(); let col = 0, maxD = 0;
    const go = (n: Node | null, d: number) => { if (!n) return; go(n.left, d + 1); p.set(n, { x: col++, d }); maxD = Math.max(maxD, d); go(n.right, d + 1); };
    go(root, 0);
    return { p, cols: Math.max(1, col), rows: maxD + 1 };
  }, [root]);
  const nodes = [...pos.p.entries()];
  const edges: [Node, Node][] = [];
  nodes.forEach(([n]) => { if (n.left) edges.push([n, n.left]); if (n.right) edges.push([n, n.right]); });
  const px = (x: number) => ((x + 0.5) / pos.cols) * 100;
  const py = (d: number) => ((d + 0.5) / pos.rows) * 100;
  const pct = (v: number) => ((v - MINV) / (MAXV - MINV)) * 100;

  return (
    <div className="ivt">
      <p className="ivt-intro">
        Which intervals overlap a query range? Instead of checking all of them, an interval tree keys a BST by
        each interval's <strong>low</strong> endpoint and stores, at every node, the <strong>maximum high</strong>
        in its subtree. During a search, if a subtree's max-high is below the query, nothing in it can reach —
        <strong> prune it</strong>. Slide the query:
      </p>

      <div className="ivt-line">
        <div className="ivt-qband" style={{ left: `${pct(q[0])}%`, width: `${pct(q[1]) - pct(q[0])}%` }} />
        {INTERVALS.map(([lo, hi], i) => {
          const hit = hitSet.has(`${lo},${hi}`);
          return (
            <div key={i} className={`ivt-bar ${hit ? 'hit' : ''}`} style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`, top: `${8 + i * 15}px` }} title={`[${lo}, ${hi}]`}>[{lo},{hi}]</div>
          );
        })}
        <div className="ivt-axis">{Array.from({ length: 7 }, (_, i) => <span key={i} style={{ left: `${(i / 6) * 100}%` }}>{Math.round(MINV + (i / 6) * (MAXV - MINV))}</span>)}</div>
      </div>

      <div className="ivt-sliders">
        <label>query low <b>{q[0]}</b><input type="range" min={MINV} max={MAXV} value={qLo} onChange={(e) => setQLo(+e.target.value)} /></label>
        <label>query high <b>{q[1]}</b><input type="range" min={MINV} max={MAXV} value={qHi} onChange={(e) => setQHi(+e.target.value)} /></label>
      </div>

      <div className="ivt-treewrap">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="ivt-svg">
          {edges.map(([a, b], i) => { const pa = pos.p.get(a)!, pb = pos.p.get(b)!; return <line key={i} x1={px(pa.x)} y1={py(pa.d)} x2={px(pb.x)} y2={py(pb.d)} className="ivt-edge" />; })}
        </svg>
        {nodes.map(([n], i) => {
          const p = pos.p.get(n)!;
          const hit = hitSet.has(`${n.lo},${n.hi}`);
          const pruned = n.max < q[0];
          return (
            <div key={i} className={`ivt-node ${hit ? 'hit' : ''} ${pruned ? 'pruned' : ''}`} style={{ left: `${px(p.x)}%`, top: `${py(p.d)}%` }}>
              <span className="ivt-iv">[{n.lo},{n.hi}]</span><span className="ivt-max">max {n.max}</span>
            </div>
          );
        })}
      </div>

      <div className="ivt-stats">
        <div className="ivt-stat ok"><span>overlaps found</span><b>{res.hits.length}</b></div>
        <div className="ivt-stat"><span>nodes visited</span><b>{res.visited} / {INTERVALS.length}</b></div>
        <div className="ivt-stat"><span>pruned</span><b>{INTERVALS.length - res.visited}</b></div>
      </div>

      <p className="ivt-foot">
        The augmentation is the whole idea: a plain BST on the low endpoint doesn't help, because overlapping
        intervals can live anywhere in it. Carrying the subtree maximum makes the low-side prune sound — if the
        biggest reach in a subtree still falls short of the query's start, skip it — and the BST order handles the
        high side (once the query ends before a node's low, its right subtree is irrelevant). That gives
        <strong> O(log n + k)</strong> for k results, versus O(n) for a scan, on a tree that still supports
        O(log n) insert and delete (keeping the max updated as you go). Augmenting a balanced tree with a summary
        of each subtree is a general, powerful pattern — the same move gives you order-statistic trees (store
        subtree sizes for "rank/select"), segment trees, and range-sum trees. For static interval sets people
        also use a <em>centered</em> interval tree or a segment tree; for the dynamic, query-as-you-go case the
        augmented BST here is the classic answer. (CLRS, ch. 14.)
      </p>
    </div>
  );
}
