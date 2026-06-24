// Segment tree — answer range queries (here, the MINIMUM over any sub-range) and point
// updates, both in O(log n). It's a binary tree over the array: each leaf is one element,
// each internal node summarizes its two children's range (the smaller of the two minima).
// A query for [l, r] descends from the root, taking whole nodes that fall entirely inside
// the range and recursing only where the range straddles a boundary — touching O(log n)
// nodes. An update fixes one leaf and walks up re-combining its ancestors. Unlike a Fenwick
// tree (which only does invertible operations like sum), a segment tree handles min/max and,
// with lazy propagation, range updates too. Pure, tested against brute force.

const INF = Infinity;

export interface SegTree { n: number; tree: number[] } // 1-indexed implicit tree, size 2n (n a power of 2)

export function build(values: number[]): SegTree {
  let n = 1; while (n < values.length) n *= 2;        // round up to a power of two
  const tree = new Array(2 * n).fill(INF);
  for (let i = 0; i < values.length; i++) tree[n + i] = values[i]; // leaves
  for (let i = n - 1; i >= 1; i--) tree[i] = Math.min(tree[2 * i], tree[2 * i + 1]); // internal mins
  return { n, tree };
}

/** Minimum over the inclusive range [l, r]. Records the tree nodes that contributed. */
export function queryMin(s: SegTree, l: number, r: number): { min: number; nodes: number[] } {
  const nodes: number[] = [];
  let lo = l + s.n, hi = r + s.n + 1; // half-open [lo, hi) on the leaf row
  let min = INF;
  while (lo < hi) {
    if (lo & 1) { min = Math.min(min, s.tree[lo]); nodes.push(lo); lo++; } // lo is a right child → take it
    if (hi & 1) { hi--; min = Math.min(min, s.tree[hi]); nodes.push(hi); } // hi-1 is a left child → take it
    lo >>= 1; hi >>= 1;
  }
  return { min, nodes };
}

/** Set element i to value, re-combining its ancestors up to the root. */
export function update(s: SegTree, i: number, value: number): number[] {
  let p = i + s.n;
  s.tree[p] = value;
  const path = [p];
  for (p >>= 1; p >= 1; p >>= 1) { s.tree[p] = Math.min(s.tree[2 * p], s.tree[2 * p + 1]); path.push(p); }
  return path;
}

/** Brute-force min, for cross-checking. */
export const naiveMin = (values: number[], l: number, r: number): number => Math.min(...values.slice(l, r + 1));

/** The depth (levels) of the tree. */
export const depth = (s: SegTree): number => Math.log2(s.n) + 1;
