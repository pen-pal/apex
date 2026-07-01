// Interval tree — a data structure that answers "which of these intervals overlap the range [q1, q2]?" in
// O(log n + k) instead of scanning all n of them. Think overlapping calendar events, genome features on a
// chromosome, firewall rules over port ranges, or "which ads are live at this timestamp." It's a binary search
// tree keyed by each interval's LOW endpoint, AUGMENTED so every node also stores the maximum HIGH endpoint
// anywhere in its subtree. That one extra number is the whole trick: when searching, if a subtree's max-high
// is less than the query's low, nothing in that entire subtree can reach the query, so you prune it and never
// look inside. That pruning is what turns a linear scan into a logarithmic descent (plus the k matches you
// actually report). Insertions keep the max updated on the way down. Reference: CLRS, "Introduction to
// Algorithms," interval trees.

export interface Node { lo: number; hi: number; max: number; left: Node | null; right: Node | null }
export type Interval = [number, number];

const mk = (lo: number, hi: number): Node => ({ lo, hi, max: hi, left: null, right: null });
const maxOf = (n: Node | null): number => (n ? n.max : -Infinity);

/** Insert [lo, hi], keyed by lo, updating each node's subtree-max on the way down. */
export function insert(root: Node | null, lo: number, hi: number): Node {
  if (!root) return mk(lo, hi);
  if (lo < root.lo) root.left = insert(root.left, lo, hi);
  else root.right = insert(root.right, lo, hi);
  root.max = Math.max(root.hi, maxOf(root.left), maxOf(root.right));
  return root;
}

export const build = (intervals: Interval[]): Node | null => intervals.reduce<Node | null>((r, [lo, hi]) => insert(r, lo, hi), null);

const overlaps = (aLo: number, aHi: number, bLo: number, bHi: number) => aLo <= bHi && bLo <= aHi;

/** All intervals overlapping [qLo, qHi], pruning subtrees whose max-high can't reach the query.
 *  `visited` counts nodes examined — compare it to n to see the pruning. */
export function search(root: Node | null, qLo: number, qHi: number): { hits: Interval[]; visited: number } {
  const hits: Interval[] = [];
  let visited = 0;
  const go = (n: Node | null) => {
    if (!n) return;
    visited++;
    if (maxOf(n) < qLo) return;                       // prune: nothing in this subtree reaches the query
    go(n.left);
    if (overlaps(n.lo, n.hi, qLo, qHi)) hits.push([n.lo, n.hi]);
    if (qHi >= n.lo) go(n.right);                     // right subtree only helps if the query extends past n.lo
  };
  go(root);
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { hits, visited };
}

/** Brute-force overlap check — the ground truth. */
export function brute(intervals: Interval[], qLo: number, qHi: number): Interval[] {
  return intervals.filter(([lo, hi]) => overlaps(lo, hi, qLo, qHi)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function inorder(root: Node | null): Node[] {
  const out: Node[] = [];
  const go = (n: Node | null) => { if (!n) return; go(n.left); out.push(n); go(n.right); };
  go(root);
  return out;
}
