// Convex hull — the smallest convex polygon that encloses a set of points, the "rubber band snapped around a bed
// of nails." It's a workhorse of computational geometry: collision detection wraps objects in their hulls for a
// cheap first test, GIS and data viz draw it as the outline of a cluster, robotics uses it for reachable regions,
// and it's the first step in many other algorithms (width, diameter, Delaunay). The elegant construction here is
// Andrew's MONOTONE CHAIN (1979): sort the points left-to-right, sweep once building the LOWER hull and once
// building the UPPER hull. The engine of both sweeps is a single primitive — the CROSS PRODUCT, which tells you
// whether three points turn left, turn right, or are collinear, with only multiplies and subtractions (no angles,
// no trigonometry, no division). While adding a point would make the chain turn the wrong way (a right turn on
// the lower hull), pop the previous point — it can't be on the hull — then push. Each point is pushed and popped
// at most once, so after the O(n log n) sort the sweep is O(n). This models the sort, the cross-product turn test,
// and the two-sweep construction. Reference: A. M. Andrew, "Another Efficient Algorithm for Convex Hulls in Two
// Dimensions," Information Processing Letters (1979).

export interface Pt { x: number; y: number }

/** Cross product of OA × OB: >0 left turn (CCW), <0 right turn (CW), 0 collinear. Integer-friendly, no trig. */
export const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Andrew's monotone chain: the convex hull in counter-clockwise order (no repeated first point). */
export function convexHull(points: Pt[]): Pt[] {
  const pts = points.slice().sort((p, q) => (p.x - q.x) || (p.y - q.y));
  // dedupe identical points (they never help and can break the chain)
  const uniq = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  if (uniq.length <= 2) return uniq;

  const build = (arr: Pt[]): Pt[] => {
    const chain: Pt[] = [];
    for (const p of arr) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= 0) chain.pop();
      chain.push(p);
    }
    chain.pop(); // drop the last (it's the start of the other half)
    return chain;
  };

  const lower = build(uniq);
  const upper = build(uniq.slice().reverse());
  return lower.concat(upper);
}

/** Is a point inside or on the (CCW) hull polygon? Every edge must keep it on the left (cross >= 0). */
export function inHull(hull: Pt[], p: Pt): boolean {
  if (hull.length < 3) return hull.some((h) => h.x === p.x && h.y === p.y);
  for (let i = 0; i < hull.length; i++) {
    if (cross(hull[i], hull[(i + 1) % hull.length], p) < 0) return false;
  }
  return true;
}
