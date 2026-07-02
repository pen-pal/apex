// Voronoi diagram — carve a plane into territories, one per "site," where every point belongs to whichever site
// is NEAREST. That single rule ("go to your closest post office / cell tower / seed crystal") produces the
// honeycomb of convex cells you see in cracked mud, giraffe coats, foam, and crystal grains, and it's one of the
// most reused structures in computing: nearest-neighbor lookup, mesh generation, coverage and facility-location
// planning, procedural textures, and motion planning all lean on it. The boundary between two neighboring cells
// is the PERPENDICULAR BISECTOR of the segment joining their sites — the set of points equidistant to both — so
// every cell is an intersection of half-planes and therefore convex (under the Euclidean metric). The Voronoi
// diagram is also the exact DUAL of the Delaunay triangulation: connect two sites whenever their cells touch and
// you get the triangulation that maximizes the smallest angle. Fortune's sweepline algorithm builds it in
// O(n log n), but the DEFINITION is just "nearest site," which is what this models directly (an exact
// assignment). Swapping the distance metric reshapes the cells: straight-line (Euclidean) gives bisector edges,
// Manhattan (taxicab) and Chebyshev (chessboard-king) give blocky diamond/square cells — the same partition rule,
// a different notion of "near." Reference: Voronoi (1908); Fortune's algorithm, SoCG (1986).

export type Metric = 'euclidean' | 'manhattan' | 'chebyshev';
export interface Site { x: number; y: number }

/** Distance under the chosen metric (Euclidean returns squared distance — fine for nearest-site comparisons). */
export function dist(m: Metric, ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  if (m === 'manhattan') return dx + dy;
  if (m === 'chebyshev') return Math.max(dx, dy);
  return dx * dx + dy * dy; // euclidean (squared — monotonic, so nearest is preserved)
}

/** Index of the nearest site to (x,y); ties resolve to the lowest index (deterministic boundaries). */
export function nearestSite(sites: Site[], x: number, y: number, m: Metric = 'euclidean'): number {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < sites.length; i++) {
    const d = dist(m, x, y, sites[i].x, sites[i].y);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Assign every grid point to its nearest site — the Voronoi diagram as a label grid. */
export function voronoiGrid(sites: Site[], cols: number, rows: number, m: Metric = 'euclidean'): Int16Array {
  const g = new Int16Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) g[y * cols + x] = nearestSite(sites, x, y, m);
  return g;
}
