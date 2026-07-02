// Delaunay, made visible. Points triangulated into fat, near-equilateral triangles (no slivers) — click to add
// more and watch it re-form. Flip on the Voronoi dual: join the circumcircle centres of neighbouring triangles
// and the Voronoi diagram appears, drawn right on top, showing the two are the same structure. Real logic from
// delaunay.ts.
import { useMemo, useState } from 'react';
import { triangulate, circumcircle, type Pt, type Tri } from './delaunay';

const W = 520, H = 360, PAD = 22;
const seed = (): Pt[] => {
  let s = 9; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s / 0x80000000) * n; };
  return Array.from({ length: 14 }, () => ({ x: 8 + rnd(84), y: 8 + rnd(84) }));
};
const shares = (t: Tri, u: Tri) => [t.a, t.b, t.c].filter((v) => [u.a, u.b, u.c].some((w) => w.x === v.x && w.y === v.y)).length === 2;

export function DelaunaySection() {
  const [points, setPoints] = useState<Pt[]>(seed);
  const [dual, setDual] = useState(false);
  const tris = useMemo(() => triangulate(points), [points]);

  const sx = (x: number) => PAD + (x / 100) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - (y / 100) * (H - 2 * PAD);
  const tPath = (t: Tri) => `M${sx(t.a.x)},${sy(t.a.y)} L${sx(t.b.x)},${sy(t.b.y)} L${sx(t.c.x)},${sy(t.c.y)} Z`;

  // Voronoi dual: segments joining circumcenters of adjacent triangles
  const dualEdges = useMemo(() => {
    if (!dual) return [];
    const cc = tris.map((t) => circumcircle(t.a, t.b, t.c));
    const segs: [number, number, number, number][] = [];
    for (let i = 0; i < tris.length; i++) for (let j = i + 1; j < tris.length; j++) if (shares(tris[i], tris[j])) segs.push([cc[i].x, cc[i].y, cc[j].x, cc[j].y]);
    return segs;
  }, [tris, dual]);

  const add = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100, y = (1 - (e.clientY - r.top) / r.height) * 100;
    if (x > 1 && x < 99 && y > 1 && y < 99) setPoints((p) => [...p, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }]);
  };

  return (
    <div className="dln">
      <p className="dln-intro">
        A <strong>Delaunay</strong> triangulation connects points into triangles that avoid slivers — it maximizes
        the smallest angle, so the triangles are as fat as the points allow. Its defining rule is the
        <strong> empty-circumcircle</strong> property: the circle through any triangle's three corners contains no
        other point. It's the exact <strong>dual of the Voronoi diagram</strong>. Click to add points; toggle the
        dual.
      </p>

      <div className="dln-tabs">
        <button type="button" className={`dln-tab ${!dual ? 'on' : ''}`} onClick={() => setDual(false)}>triangulation</button>
        <button type="button" className={`dln-tab ${dual ? 'on' : ''}`} onClick={() => setDual(true)}>+ Voronoi dual</button>
        <button type="button" className="dln-tab ghost" onClick={() => setPoints(seed())}>reset</button>
        <span className="dln-count">{points.length} points · {tris.length} triangles</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="dln-plane" onClick={add}>
        {tris.map((t, i) => <path key={i} d={tPath(t)} className="dln-tri" />)}
        {dualEdges.map((e, i) => <line key={i} x1={sx(e[0])} y1={sy(e[1])} x2={sx(e[2])} y2={sy(e[3])} className="dln-dual" />)}
        {points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.5} className="dln-pt" />)}
      </svg>

      <p className="dln-foot">
        The duality is worth staring at: every Delaunay triangle owns one circumcircle center, and those centers are
        exactly the Voronoi vertices (each equidistant from the three sites of its triangle); joining the centers of
        triangles that share an edge traces the Voronoi cell walls. So one O(n log n) computation gives you both —
        the triangulation for meshing and interpolation, the diagram for nearest-neighbor and coverage. The
        empty-circumcircle rule is what enforces the "fat triangles" guarantee, and it also makes the structure
        <em> locally</em> fixable: if inserting a point (or an edge flip) leaves an illegal triangle — one with a
        point inside its circumcircle — you flip the offending edge, and a finite sequence of such flips always
        converges to the Delaunay triangulation (Lawson's algorithm). Bowyer-Watson, shown here, takes the
        incremental route instead: enclose everything in a super-triangle, insert points one by one, and each
        insertion deletes the triangles whose circumcircles the point violates and re-fills the hole. Delaunay
        meshes underpin finite-element simulation (stress, fluids, heat), terrain from LIDAR point clouds, the
        natural-neighbor interpolation used in geosciences, and the "alpha shapes" that reconstruct a surface from a
        3-D scan. Skinny triangles ruin all of these numerically — which is exactly what Delaunay refuses to make.
        (Delaunay 1934; Bowyer &amp; Watson 1981; Lawson 1977.)
      </p>
    </div>
  );
}
