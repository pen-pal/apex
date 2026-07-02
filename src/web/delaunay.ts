// Delaunay triangulation — connect a set of points into triangles, but not just any triangles: the ones that
// avoid slivers. Among all the ways to triangulate a point set, the Delaunay triangulation maximizes the smallest
// angle, so you get triangles as close to equilateral as the points allow — exactly what you want for a finite-
// element mesh, terrain from survey points, or interpolating scattered data without ugly artifacts. Its defining
// rule is beautifully simple, the EMPTY-CIRCUMCIRCLE property: for every triangle, the unique circle through its
// three corners contains NO other point of the set. If some point sneaks inside a triangle's circumcircle, that
// triangle is "illegal" and you flip the shared edge to fix it. And it is the exact DUAL of the Voronoi diagram —
// connect two sites whose Voronoi cells share an edge and you get precisely the Delaunay edges; the circumcircle
// centers ARE the Voronoi vertices. This builds it with the incremental BOWYER-WATSON algorithm: start with one
// huge "super-triangle" enclosing everything, then insert points one at a time. To insert a point, find every
// triangle whose circumcircle it falls inside (those are now illegal), delete them — they leave a star-shaped
// hole — and re-triangulate the hole by joining the new point to each of its boundary edges. Delete the triangles
// touching the super-triangle at the end and what remains is Delaunay. This models the circumcircle test and the
// insertion. Reference: Bowyer (1981) and Watson (1981), The Computer Journal; Delaunay (1934).

export interface Pt { x: number; y: number }
export interface Tri { a: Pt; b: Pt; c: Pt }

/** Circumcircle of a triangle: centre equidistant from all three vertices, plus squared radius. */
export function circumcircle(a: Pt, b: Pt, c: Pt): { x: number; y: number; r2: number } {
  const ad = a.x * a.x + a.y * a.y, bd = b.x * b.x + b.y * b.y, cd = c.x * c.x + c.y * c.y;
  const D = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const x = (ad * (b.y - c.y) + bd * (c.y - a.y) + cd * (a.y - b.y)) / D;
  const y = (ad * (c.x - b.x) + bd * (a.x - c.x) + cd * (b.x - a.x)) / D;
  return { x, y, r2: (a.x - x) ** 2 + (a.y - y) ** 2 };
}

/** Is p strictly inside the triangle's circumcircle? (the Delaunay legality test) */
export function inCircumcircle(t: Tri, p: Pt, eps = 1e-9): boolean {
  const c = circumcircle(t.a, t.b, t.c);
  return (p.x - c.x) ** 2 + (p.y - c.y) ** 2 < c.r2 - eps;
}

const same = (p: Pt, q: Pt) => p.x === q.x && p.y === q.y;

/** Bowyer-Watson incremental Delaunay triangulation of `points`. Returns triangles over the input points only. */
export function triangulate(points: Pt[]): Tri[] {
  if (points.length < 3) return [];
  // super-triangle enclosing all points, big enough that its corners never fall inside a real circumcircle
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const p of points) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); }
  const dx = maxx - minx || 1, dy = maxy - miny || 1, d = Math.max(dx, dy) * 20;
  const midx = (minx + maxx) / 2, midy = (miny + maxy) / 2;
  const s1: Pt = { x: midx - d, y: midy - d }, s2: Pt = { x: midx + d, y: midy - d }, s3: Pt = { x: midx, y: midy + d };
  let tris: Tri[] = [{ a: s1, b: s2, c: s3 }];

  for (const p of points) {
    const bad = tris.filter((t) => inCircumcircle(t, p));
    // collect the boundary of the hole: edges belonging to exactly one bad triangle
    const edges: [Pt, Pt][] = [];
    for (const t of bad) { edges.push([t.a, t.b], [t.b, t.c], [t.c, t.a]); }
    const boundary = edges.filter(([u, v]) =>
      edges.filter(([x, y]) => (same(x, u) && same(y, v)) || (same(x, v) && same(y, u))).length === 1);
    tris = tris.filter((t) => !bad.includes(t));
    for (const [u, v] of boundary) tris.push({ a: u, b: v, c: p });
  }
  // drop any triangle touching a super-triangle corner
  const sup = [s1, s2, s3];
  return tris.filter((t) => ![t.a, t.b, t.c].some((v) => sup.some((s) => same(v, s))));
}
