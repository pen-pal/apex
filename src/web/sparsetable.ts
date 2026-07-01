// Sparse table — a data structure that answers "what's the minimum in range [l, r]?" in O(1) time after an
// O(n log n) precompute, for a STATIC array. A segment tree also does range-min, but in O(log n) per query and
// with support for updates; if your array never changes (and many don't — a precomputed cost map, a
// sparse-index over an immutable column), you can do better. The idea leans on one special property of MIN
// (and max, gcd, AND, OR): it's IDEMPOTENT — min(x, x) = x — so overlapping two ranges that together cover
// [l, r] gives the right answer even though they double-count the middle. Precompute, for every position i and
// every power of two 2^k, the minimum of the block starting at i of length 2^k: table[k][i] = min of
// a[i .. i+2^k-1]. Each level is built from the one below in O(1) per cell (a block of length 2^k is two blocks
// of length 2^(k-1)). Then ANY query [l, r] is covered by exactly two of these power-of-two blocks — one
// anchored at l, one ending at r — that overlap in the middle: pick k = ⌊log2(r-l+1)⌋ and return
// min(table[k][l], table[k][r-2^k+1]). Two array lookups, one min, done — no loop over the range. Reference:
// Bender & Farach-Colton, "The LCA Problem Revisited" (the sparse-table RMQ); a staple of competitive
// programming and read-only analytics indexes.

/** Build the sparse table: table[k][i] = min of a[i .. i+2^k-1]. */
export function build(a: number[]): number[][] {
  const n = a.length;
  if (n === 0) return [];
  const K = Math.floor(Math.log2(n)) + 1;
  const table: number[][] = [a.slice()];
  for (let k = 1; k < K; k++) {
    const half = 1 << (k - 1);
    const len = 1 << k;
    const row: number[] = [];
    for (let i = 0; i + len <= n; i++) row[i] = Math.min(table[k - 1][i], table[k - 1][i + half]);
    table[k] = row;
  }
  return table;
}

/** O(1) range-minimum query over the inclusive range [l, r]. Returns the two blocks used, for visualization. */
export function query(table: number[][], l: number, r: number): { value: number; k: number; blocks: [number, number] } {
  const k = Math.floor(Math.log2(r - l + 1));
  const lo = l, hi = r - (1 << k) + 1;             // two length-2^k blocks that together cover [l, r]
  return { value: Math.min(table[k][lo], table[k][hi]), k, blocks: [lo, hi] };
}

/** Brute-force range minimum — the ground truth. */
export function brute(a: number[], l: number, r: number): number {
  let m = a[l];
  for (let i = l + 1; i <= r; i++) m = Math.min(m, a[i]);
  return m;
}
