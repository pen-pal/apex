// k-d tree, made visible. The plane is recursively split — vertical line, then horizontal, alternating — so
// each point owns a rectangle. Click anywhere to drop a query point; the tree finds its nearest neighbour and
// the readout shows how few points it actually had to check versus a brute-force scan of all of them. That
// gap is the pruning: whole rectangles on the far side of a split get skipped. Real model from kdtree.ts.
import { useMemo, useRef, useState } from 'react';
import { build, nearest, bruteNearest, type KdNode, type Point } from './kdtree';

// fixed deterministic point cloud
const POINTS: Point[] = (() => {
  let s = 42; const r = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: 24 }, () => ({ x: 6 + Math.round(r() * 88), y: 6 + Math.round(r() * 88) }));
})();

interface Seg { x1: number; y1: number; x2: number; y2: number; axis: 0 | 1 }
function splitLines(node: KdNode | null, box: [number, number, number, number], out: Seg[]) {
  if (!node) return;
  const [xmin, xmax, ymin, ymax] = box;
  if (node.axis === 0) {
    out.push({ x1: node.point.x, y1: ymin, x2: node.point.x, y2: ymax, axis: 0 });
    splitLines(node.left, [xmin, node.point.x, ymin, ymax], out);
    splitLines(node.right, [node.point.x, xmax, ymin, ymax], out);
  } else {
    out.push({ x1: xmin, y1: node.point.y, x2: xmax, y2: node.point.y, axis: 1 });
    splitLines(node.left, [xmin, xmax, ymin, node.point.y], out);
    splitLines(node.right, [xmin, xmax, node.point.y, ymax], out);
  }
}

export function KdTreeSection() {
  const root = useMemo(() => build(POINTS), []);
  const lines = useMemo(() => { const out: Seg[] = []; splitLines(root, [0, 100, 0, 100], out); return out; }, [root]);
  const [q, setQ] = useState<Point>({ x: 55, y: 40 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const res = nearest(root, q);
  const brute = bruteNearest(POINTS, q);

  const onClick = (e: React.MouseEvent) => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setQ({ x: Math.round(((e.clientX - rect.left) / rect.width) * 100), y: Math.round(((e.clientY - rect.top) / rect.height) * 100) });
  };

  return (
    <div className="kdt">
      <p className="kdt-intro">
        A tree that indexes points in space so you can find the <strong>nearest</strong> one without checking
        them all. It splits the plane recursively — <strong>vertical, then horizontal, alternating</strong> —
        giving every point a rectangle. A query walks to its rectangle, then backtracks, but <strong>skips any
        rectangle on the far side of a split that's already too far away</strong>. Click to move the query.
      </p>

      <div className="kdt-canvas">
        <svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none" className="kdt-svg" onClick={onClick}>
          {lines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className={`kdt-split ${l.axis === 0 ? 'v' : 'h'}`} />)}
          {res.point && <line x1={q.x} y1={q.y} x2={res.point.x} y2={res.point.y} className="kdt-link" />}
          {POINTS.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.6} className={`kdt-pt ${res.point && p.x === res.point.x && p.y === res.point.y ? 'near' : ''}`} />)}
          <circle cx={q.x} cy={q.y} r={2.2} className="kdt-q" />
        </svg>
      </div>

      <div className="kdt-stats">
        <div className="kdt-stat"><span>query</span><b>({q.x}, {q.y})</b></div>
        <div className="kdt-stat ok"><span>nearest</span><b>{res.point ? `(${res.point.x}, ${res.point.y})` : '—'}</b></div>
        <div className="kdt-stat"><span>distance</span><b>{res.dist.toFixed(1)}</b></div>
        <div className="kdt-stat ok"><span>points checked</span><b>{res.visited} / {brute.visited}</b></div>
        <div className="kdt-stat ok"><span>pruned</span><b>{Math.round((1 - res.visited / brute.visited) * 100)}%</b></div>
      </div>

      <p className="kdt-foot">
        The pruning rule is one comparison: at each node, only descend the far child if the perpendicular
        distance to the splitting line is less than your current best — otherwise nothing over there can be
        closer, so skip it. On uniform data that gives roughly <strong>O(log n)</strong> queries after an
        O(n log n) build. Two caveats. <strong>High dimensions</strong>: as k grows, hyperspheres fill space
        so poorly that pruning fails and it degenerates to a full scan (the "curse of dimensionality") — past
        ~20 dims people switch to approximate methods (LSH, HNSW). <strong>Updates</strong>: a classic k-d tree
        doesn't rebalance on insert/delete, so dynamic sets use R-trees or periodic rebuilds instead. Same
        median-split idea extends to range search ("all points in this box") and to k-nearest, not just the
        single nearest. (Jon Bentley, 1975.)
      </p>
    </div>
  );
}
