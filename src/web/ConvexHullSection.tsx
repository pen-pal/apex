// Convex hull, made visible. Points scattered on a plane, with the hull drawn as the rubber band snapped around
// the outermost ones. Click to add points and watch the hull re-form; the interior points (which the algorithm
// pops off) fade, the hull vertices stay bright. Real logic from convexhull.ts.
import { useMemo, useState } from 'react';
import { convexHull, type Pt } from './convexhull';

const W = 520, H = 360, PAD = 24;
const seedPts = (): Pt[] => {
  let s = 7; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s / 0x80000000) * n; };
  return Array.from({ length: 14 }, () => ({ x: 8 + rnd(84), y: 8 + rnd(84) }));
};

export function ConvexHullSection() {
  const [points, setPoints] = useState<Pt[]>(seedPts);
  const hull = useMemo(() => convexHull(points), [points]);
  const onHull = useMemo(() => new Set(hull.map((p) => `${p.x},${p.y}`)), [hull]);

  const sx = (x: number) => PAD + (x / 100) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - (y / 100) * (H - 2 * PAD); // y up
  const hullPath = hull.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ') + ' Z';

  const add = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100, y = (1 - (e.clientY - r.top) / r.height) * 100;
    if (x > 2 && x < 98 && y > 2 && y < 98) setPoints((p) => [...p, { x: Math.round(x), y: Math.round(y) }]);
  };

  return (
    <div className="cvh">
      <p className="cvh-intro">
        The convex hull is the smallest convex polygon containing every point — the shape a rubber band makes when
        you let it snap around a bed of nails. Andrew's <strong>monotone chain</strong> sorts the points left to
        right, then sweeps once for the bottom edge and once for the top, using one primitive at each step: the
        <strong> cross product</strong>, which says whether three points turn left, right, or straight — no angles,
        no trig. Click to add points.
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="cvh-plane" onClick={add}>
        {hull.length >= 3 && <path d={hullPath} className="cvh-hull" />}
        {points.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={onHull.has(`${p.x},${p.y}`) ? 5.5 : 3.5} className={`cvh-pt ${onHull.has(`${p.x},${p.y}`) ? 'on' : 'in'}`} />
        ))}
      </svg>

      <div className="cvh-controls">
        <button type="button" className="cvh-btn" onClick={() => setPoints(seedPts())}>reset</button>
        <button type="button" className="cvh-btn" onClick={() => setPoints([])}>clear</button>
        <div className="cvh-stat"><span>points</span> <b>{points.length}</b></div>
        <div className="cvh-stat"><span>hull vertices</span> <b>{hull.length}</b></div>
      </div>

      <p className="cvh-foot">
        Notice the interior points do nothing — the hull depends only on the extreme ones, and monotone chain finds
        them by popping any point that would make the chain turn the wrong way (a "right turn" on the lower hull
        means the middle point is a dent, not a corner). Each point is pushed and popped at most once, so the sweep
        is linear; the only real cost is the initial O(n log n) sort, which makes the whole thing O(n log n) — and
        that's optimal, because computing a hull can sort numbers (place them on a parabola and the hull order
        recovers the sorted order). The cross product is the quiet hero here and across geometry: its sign is an
        exact, division-free orientation test, and the same primitive drives point-in-polygon, segment
        intersection, and Delaunay triangulation. Beyond 2-D the idea generalizes (gift wrapping, QuickHull,
        incremental 3-D hulls) and shows up wherever you need the outline of data or a cheap bounding shape:
        collision broad-phase, GIS cluster outlines, path planning, and as the first step of computing a shape's
        width or diameter. (Andrew, 1979; the gift-wrapping and Graham-scan hulls are close cousins.)
      </p>
    </div>
  );
}
