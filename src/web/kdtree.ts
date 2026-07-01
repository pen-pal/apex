// k-d tree — a binary tree that indexes points in k-dimensional space so you can find the NEAREST neighbour
// without checking every point. In 2-D it recursively splits the plane: the root splits on x (a vertical
// line), its children split on y (horizontal lines), grandchildren on x again, alternating down the tree.
// Each node owns a rectangular region. A nearest-neighbour query walks down to the leaf whose region contains
// the query, then backtracks — but here's the trick that makes it sub-linear: at each node it only descends
// the FAR subtree if the splitting line is closer than the best point found so far. Whole regions get pruned
// untouched. It powers spatial databases, graphics (ray tracing, collision), k-NN in machine learning, and
// geospatial "what's near me". (It degrades in very high dimensions — the curse of dimensionality — where
// approximate methods take over.) Reference: Bentley (1975).

export interface Point { x: number; y: number }
export interface KdNode { point: Point; axis: 0 | 1; left: KdNode | null; right: KdNode | null }

const coord = (p: Point, axis: 0 | 1) => (axis === 0 ? p.x : p.y);
const dist2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Build a balanced 2-D k-d tree: sort by the current axis, take the median as the node, recurse, alternating
 *  the split axis each level. */
export function build(points: Point[], depth = 0): KdNode | null {
  if (points.length === 0) return null;
  const axis: 0 | 1 = (depth % 2) as 0 | 1;
  const sorted = [...points].sort((a, b) => coord(a, axis) - coord(b, axis));
  const mid = Math.floor(sorted.length / 2);
  return {
    point: sorted[mid], axis,
    left: build(sorted.slice(0, mid), depth + 1),
    right: build(sorted.slice(mid + 1), depth + 1),
  };
}

export interface NearestResult { point: Point | null; dist: number; visited: number }

/** Nearest-neighbour search with plane pruning. `visited` counts nodes examined — compare it to the total
 *  point count to see how much the pruning saved versus a brute-force scan. */
export function nearest(root: KdNode | null, q: Point): NearestResult {
  let best: Point | null = null, bestD2 = Infinity, visited = 0;
  const go = (node: KdNode | null) => {
    if (!node) return;
    visited++;
    const d2 = dist2(node.point, q);
    if (d2 < bestD2) { bestD2 = d2; best = node.point; }
    const diff = coord(q, node.axis) - coord(node.point, node.axis); // signed distance to the splitting line
    const near = diff < 0 ? node.left : node.right;
    const far = diff < 0 ? node.right : node.left;
    go(near);
    if (diff * diff < bestD2) go(far); // only cross the plane if it could hold something closer
  };
  go(root);
  return { point: best, dist: Math.sqrt(bestD2), visited };
}

/** Brute-force nearest — the ground truth to check the tree against. */
export function bruteNearest(points: Point[], q: Point): NearestResult {
  let best: Point | null = null, bestD2 = Infinity;
  for (const p of points) { const d2 = dist2(p, q); if (d2 < bestD2) { bestD2 = d2; best = p; } }
  return { point: best, dist: Math.sqrt(bestD2), visited: points.length };
}
