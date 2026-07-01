// Median of medians (the BFPRT algorithm) — how to find the k-th smallest element (a median, a percentile) in
// GUARANTEED linear time, even in the worst case. Plain quickselect is O(n) on average but O(n²) if you keep
// picking terrible pivots — and an adversary (or just already-sorted input with a naive pivot) can force exactly
// that. The fix is to spend a little work choosing a pivot that is provably "not too lopsided." The trick, due
// to Blum–Floyd–Pratt–Rivest–Tarjan (1973): break the array into groups of 5, find each group's median (cheap —
// five elements), then recursively find the median OF those medians, and use THAT as the pivot. Why it works:
// the median-of-medians is ≥ half of the group medians, and each of those is ≥ 2 of its own group's elements, so
// the pivot is guaranteed to be greater than at least ~30% of all elements and less than at least ~30% — it can
// never land in the extreme 30% tails. That bounds how unbalanced the partition can be, so each recursive step
// throws away a constant fraction, giving a linear recurrence T(n) = T(n/5) + T(7n/10) + O(n) that solves to
// O(n). The groups of 5 are the magic number: 3 is too small (the recursion doesn't shrink enough) and 7+ costs
// more per group for little gain. It's more of theoretical beauty than everyday use (the constant is large, so
// real code uses randomized quickselect or introselect), but it's the proof that selection is linear in the
// worst case — and the same "recurse on a summary to pick a good pivot" idea shows up throughout algorithms.
// Reference: Blum, Floyd, Pratt, Rivest, Tarjan, "Time bounds for selection" (1973).

const med5 = (g: number[]): number => [...g].sort((a, b) => a - b)[Math.floor(g.length / 2)];

/** The median-of-medians pivot VALUE for arr[lo..hi]. */
export function pivotValue(arr: number[], lo: number, hi: number): number {
  const medians: number[] = [];
  for (let i = lo; i <= hi; i += 5) medians.push(med5(arr.slice(i, Math.min(i + 5, hi + 1))));
  return medians.length === 1 ? medians[0] : select(medians, Math.floor(medians.length / 2));
}

/** Lomuto partition of arr[lo..hi] around the value `pivot`; returns the pivot's final index. */
function partition(arr: number[], lo: number, hi: number, pivot: number): number {
  let pi = lo; while (arr[pi] !== pivot) pi++;
  [arr[pi], arr[hi]] = [arr[hi], arr[pi]];
  let store = lo;
  for (let i = lo; i < hi; i++) if (arr[i] < pivot) { [arr[i], arr[store]] = [arr[store], arr[i]]; store++; }
  [arr[store], arr[hi]] = [arr[hi], arr[store]];
  return store;
}

/** The k-th smallest element (0-indexed) of `a`, in guaranteed O(n). */
export function select(a: number[], k: number): number {
  const arr = a.slice();
  let lo = 0, hi = arr.length - 1;
  for (;;) {
    if (lo === hi) return arr[lo];
    const p = partition(arr, lo, hi, pivotValue(arr, lo, hi));
    if (k === p) return arr[p];
    if (k < p) hi = p - 1; else lo = p + 1;
  }
}

export interface PivotAnalysis { groups: number[][]; medians: number[]; pivot: number; less: number; greater: number; equal: number; n: number }

/** Expose one level of pivot selection (groups of 5, their medians, the chosen pivot, and its balance). */
export function analyze(a: number[]): PivotAnalysis {
  const groups: number[][] = [];
  for (let i = 0; i < a.length; i += 5) groups.push(a.slice(i, i + 5));
  const medians = groups.map(med5);
  const pivot = pivotValue(a, 0, a.length - 1);
  let less = 0, greater = 0, equal = 0;
  for (const x of a) { if (x < pivot) less++; else if (x > pivot) greater++; else equal++; }
  return { groups, medians, pivot, less, greater, equal, n: a.length };
}
