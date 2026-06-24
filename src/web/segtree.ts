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

// ---- lazy propagation: range UPDATE + range query ----------------------------------------------
// The point-update tree above can't add a value to a whole range without touching every element.
// Lazy propagation fixes that: when a range-add fully covers a node, we stamp the node's min and
// park the delta in a LAZY tag instead of recursing into its children. The tag is only "pushed
// down" later, the next time a query or update actually needs to descend through that node. So a
// range-add over any [l, r] tags only O(log n) nodes — the same handful a query touches.

export interface LazyTree { n: number; min: number[]; lazy: number[] } // recursive tree, node-indexed (4n)

export function buildLazy(values: number[]): LazyTree {
  const n = values.length;
  const t: LazyTree = { n, min: new Array(4 * Math.max(1, n)).fill(0), lazy: new Array(4 * Math.max(1, n)).fill(0) };
  const rec = (node: number, lo: number, hi: number) => {
    if (lo === hi) { t.min[node] = values[lo]; return; }
    const mid = (lo + hi) >> 1;
    rec(2 * node, lo, mid); rec(2 * node + 1, mid + 1, hi);
    t.min[node] = Math.min(t.min[2 * node], t.min[2 * node + 1]);
  };
  if (n > 0) rec(1, 0, n - 1);
  return t;
}

function pushDown(t: LazyTree, node: number): void {
  const d = t.lazy[node];
  if (d !== 0) {
    for (const c of [2 * node, 2 * node + 1]) { t.min[c] += d; t.lazy[c] += d; }
    t.lazy[node] = 0;
  }
}

/** Add `delta` to every element in [l, r]. Returns the node ids that absorbed the change as a
 *  lazy tag (the O(log n) "frontier" — proof that we did NOT touch every covered leaf). */
export function rangeAdd(t: LazyTree, l: number, r: number, delta: number): number[] {
  const tagged: number[] = [];
  const rec = (node: number, lo: number, hi: number) => {
    if (r < lo || hi < l) return; // disjoint
    if (l <= lo && hi <= r) { t.min[node] += delta; t.lazy[node] += delta; tagged.push(node); return; } // fully covered → tag, stop
    pushDown(t, node);
    const mid = (lo + hi) >> 1;
    rec(2 * node, lo, mid); rec(2 * node + 1, mid + 1, hi);
    t.min[node] = Math.min(t.min[2 * node], t.min[2 * node + 1]);
  };
  if (t.n > 0) rec(1, 0, t.n - 1);
  return tagged;
}

/** Minimum over [l, r], pushing lazy tags down along the way. */
export function queryLazy(t: LazyTree, l: number, r: number): number {
  const rec = (node: number, lo: number, hi: number): number => {
    if (r < lo || hi < l) return INF;
    if (l <= lo && hi <= r) return t.min[node];
    pushDown(t, node);
    const mid = (lo + hi) >> 1;
    return Math.min(rec(2 * node, lo, mid), rec(2 * node + 1, mid + 1, hi));
  };
  return t.n > 0 ? rec(1, 0, t.n - 1) : INF;
}

/** Materialize the current element values (each is a single-point query). */
export const toArray = (t: LazyTree): number[] => Array.from({ length: t.n }, (_, i) => queryLazy(t, i, i));
