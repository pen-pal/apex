// Quickselect — find the k-th smallest element WITHOUT fully sorting, in O(n) average time. It's quicksort
// that only recurses into the side containing the answer: partition around a pivot, and the pivot lands at
// its final sorted position p. If p === k you're done; if k < p the answer is to the left, else to the
// right — so you discard the other half each time. The expected work is n + n/2 + n/4 + … ≈ 2n, versus
// O(n log n) to sort just to read one element. It's how you get a median or a p99 latency in linear time;
// databases and analytics engines use it (and its cousin introselect / median-of-medians for the
// worst-case guarantee). Reference: Hoare's FIND (1961); CLRS §9.2.

export interface QsStep { lo: number; hi: number; pivotValue: number; landedAt: number; goesLeft: boolean | null }
export interface QsResult { value: number; steps: QsStep[]; comparisons: number; sortedAt: number }

const medianOfThreeIndex = (a: number[], i: number, j: number, k: number): number => {
  const x = a[i], y = a[j], z = a[k];
  if ((x <= y && y <= z) || (z <= y && y <= x)) return j;
  if ((y <= x && x <= z) || (z <= x && x <= y)) return i;
  return k;
};

/** Return the k-th smallest (0-indexed) of `input`, with the partition trace. Deterministic median-of-three
 *  pivot (no RNG) so it's reproducible. Throws if k is out of range. */
export function quickselect(input: number[], k: number): QsResult {
  if (k < 0 || k >= input.length) throw new Error(`k=${k} out of range for length ${input.length}`);
  const a = [...input];
  const swap = (i: number, j: number) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
  const steps: QsStep[] = [];
  let lo = 0, hi = a.length - 1, comparisons = 0;

  for (;;) {
    if (lo === hi) { steps.push({ lo, hi, pivotValue: a[lo], landedAt: lo, goesLeft: null }); return { value: a[lo], steps, comparisons, sortedAt: lo }; }
    // choose a median-of-three pivot and park it at hi
    const mid = (lo + hi) >> 1;
    swap(medianOfThreeIndex(a, lo, mid, hi), hi);
    const pivotValue = a[hi];
    // Lomuto partition: everything < pivot moves to the front
    let i = lo;
    for (let j = lo; j < hi; j++) { comparisons++; if (a[j] < pivotValue) { swap(i, j); i++; } }
    swap(i, hi); // pivot reaches its final sorted index i
    const goesLeft = k === i ? null : k < i;
    steps.push({ lo, hi, pivotValue, landedAt: i, goesLeft });
    if (i === k) return { value: a[i], steps, comparisons, sortedAt: i };
    if (k < i) hi = i - 1; else lo = i + 1; // recurse into the side holding k only
  }
}
