// Fenwick tree / Binary Indexed Tree (Fenwick, 1994) — keep a running array where BOTH
// "add to element i" and "sum of the first i elements" cost O(log n), instead of one being
// O(1) and the other O(n). The trick is binary: tree[i] stores the sum of a block of
// elements ending at i whose LENGTH is the lowest set bit of i (i & −i). To update, you
// climb to every block that covers i by repeatedly adding that low bit; to take a prefix
// sum, you descend by repeatedly stripping it. So each operation touches only ~log n blocks
// — one per set bit. It's the structure behind range-sum queries, order statistics, and
// many competitive-programming and database aggregates. Pure, tested.

export interface Fenwick { n: number; tree: number[] } // 1-indexed; tree[0] unused

export function build(values: number[]): Fenwick {
  const n = values.length;
  const f: Fenwick = { n, tree: new Array(n + 1).fill(0) };
  values.forEach((v, i) => update(f, i + 1, v));
  return f;
}

/** Add `delta` to element `i` (1-indexed), climbing to every covering block. */
export function update(f: Fenwick, i: number, delta: number): number[] {
  const touched: number[] = [];
  for (; i <= f.n; i += i & -i) { f.tree[i] += delta; touched.push(i); }
  return touched; // the indices visited (for the visualization)
}

/** Prefix sum of elements 1..i, descending by stripping the low bit each step. */
export function query(f: Fenwick, i: number): { sum: number; visited: number[] } {
  let sum = 0; const visited: number[] = [];
  for (; i > 0; i -= i & -i) { sum += f.tree[i]; visited.push(i); }
  return { sum, visited };
}

export const rangeQuery = (f: Fenwick, l: number, r: number): number => query(f, r).sum - query(f, l - 1).sum;

/** The block each tree node is responsible for: [i − lowbit + 1 .. i]. */
export const responsibility = (i: number): [number, number] => [i - (i & -i) + 1, i];
