// Union-Find (Disjoint Set Union) — the data structure that answers "are these two things
// in the same group?" in almost O(1), and merges two groups just as fast. Each element
// points at a parent; following parents up reaches a root that names the set. Two
// optimizations make it near-constant: UNION BY RANK attaches the shorter tree under the
// taller (keeping trees flat), and PATH COMPRESSION re-points every node visited during a
// find straight at the root. Together they give the inverse-Ackermann bound — effectively
// constant. It powers Kruskal's minimum-spanning-tree, network-connectivity checks, and
// image segmentation. Pure, tested.

export interface DSU { parent: number[]; rank: number[]; count: number }

export const create = (n: number): DSU => ({ parent: Array.from({ length: n }, (_, i) => i), rank: new Array(n).fill(0), count: n });

/** Find the set's root, compressing the path so future finds are O(1). */
export function find(dsu: DSU, x: number): number {
  const path: number[] = [];
  let root = x;
  while (dsu.parent[root] !== root) { path.push(root); root = dsu.parent[root]; }
  for (const node of path) dsu.parent[node] = root; // path compression
  return root;
}

export interface UnionResult { merged: boolean; root: number }

/** Merge the sets containing x and y, attaching the shorter tree under the taller. */
export function union(dsu: DSU, x: number, y: number): UnionResult {
  let rx = find(dsu, x), ry = find(dsu, y);
  if (rx === ry) return { merged: false, root: rx }; // already together
  if (dsu.rank[rx] < dsu.rank[ry]) [rx, ry] = [ry, rx]; // rx is the taller (or equal) root
  dsu.parent[ry] = rx;
  if (dsu.rank[rx] === dsu.rank[ry]) dsu.rank[rx]++; // equal ranks → result is one taller
  dsu.count--;
  return { merged: true, root: rx };
}

export const connected = (dsu: DSU, x: number, y: number): boolean => find(dsu, x) === find(dsu, y);

/** Group elements by their current root (for display). */
export function groups(dsu: DSU): Record<number, number[]> {
  const g: Record<number, number[]> = {};
  for (let i = 0; i < dsu.parent.length; i++) { const r = find(dsu, i); (g[r] ??= []).push(i); }
  return g;
}
