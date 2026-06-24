// Sorting algorithms, instrumented — each returns the sorted array plus a frame-by-frame
// trace (array snapshots with the indices being compared/written) and the comparison/swap
// counts, so you can watch HOW each one works and contrast the O(n²) quadratic sorts
// (bubble, insertion, selection) with the O(n log n) divide-and-conquer ones (merge, quick).
// The point is the trade-offs: bubble/insertion are simple and adaptive on nearly-sorted
// data; merge is stable and predictable; quick is fast in practice but worst-case quadratic.
// Pure; tested for correctness and for hand-counted operation totals.

export interface Frame { array: number[]; active: number[]; sorted: number[] }
export interface Trace { result: number[]; frames: Frame[]; comparisons: number; swaps: number }

function tracer(arr: number[]) {
  const a = [...arr];
  const frames: Frame[] = [];
  let comparisons = 0, swaps = 0;
  const snap = (active: number[], sorted: number[] = []) => frames.push({ array: [...a], active: [...active], sorted: [...sorted] });
  return {
    a,
    cmp: () => comparisons++,
    swap: (i: number, j: number) => { [a[i], a[j]] = [a[j], a[i]]; swaps++; },
    write: () => swaps++, // a placement (merge) counts as a write, not a swap of two cells
    snap,
    // snapshot an explicitly-provided full array (used by merge, where the live array is
    // mid-rewrite); guarantees every frame stays a true permutation of the input
    snapArray: (array: number[], active: number[]) => frames.push({ array: [...array], active: [...active], sorted: [] }),
    done: (): Trace => ({ result: [...a], frames, comparisons, swaps }),
  };
}

export function bubbleSort(arr: number[]): Trace {
  const t = tracer(arr); const n = t.a.length;
  const sorted: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      t.cmp(); t.snap([j, j + 1], sorted);
      if (t.a[j] > t.a[j + 1]) { t.swap(j, j + 1); t.snap([j, j + 1], sorted); }
    }
    sorted.unshift(n - 1 - i);
  }
  return t.done();
}

export function insertionSort(arr: number[]): Trace {
  const t = tracer(arr); const n = t.a.length;
  for (let i = 1; i < n; i++) {
    let j = i;
    while (j > 0) { t.cmp(); t.snap([j - 1, j]); if (t.a[j - 1] <= t.a[j]) break; t.swap(j - 1, j); j--; }
  }
  return t.done();
}

export function selectionSort(arr: number[]): Trace {
  const t = tracer(arr); const n = t.a.length;
  const sorted: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    let min = i;
    for (let j = i + 1; j < n; j++) { t.cmp(); t.snap([min, j], sorted); if (t.a[j] < t.a[min]) min = j; }
    if (min !== i) t.swap(i, min);
    sorted.push(i); t.snap([i, min], sorted);
  }
  return t.done();
}

export function mergeSort(arr: number[]): Trace {
  const t = tracer(arr);
  const merge = (lo: number, mid: number, hi: number) => {
    const left = t.a.slice(lo, mid + 1), right = t.a.slice(mid + 1, hi + 1);
    let i = 0, j = 0;
    const merged: number[] = [];
    // a snapshot of the WHOLE array: untouched prefix + merged-so-far + the not-yet-placed
    // remainders of left/right + untouched suffix — always a permutation of the input
    const snapMerge = () => t.snapArray(
      [...t.a.slice(0, lo), ...merged, ...left.slice(i), ...right.slice(j), ...t.a.slice(hi + 1)],
      [lo + merged.length - 1],
    );
    while (i < left.length && j < right.length) {
      t.cmp();
      if (left[i] <= right[j]) merged.push(left[i++]); else merged.push(right[j++]);
      t.write(); snapMerge();
    }
    while (i < left.length) { merged.push(left[i++]); t.write(); snapMerge(); }
    while (j < right.length) { merged.push(right[j++]); t.write(); snapMerge(); }
    for (let x = 0; x < merged.length; x++) t.a[lo + x] = merged[x]; // commit the merged run
  };
  const rec = (lo: number, hi: number) => { if (lo >= hi) return; const mid = (lo + hi) >> 1; rec(lo, mid); rec(mid + 1, hi); merge(lo, mid, hi); };
  rec(0, t.a.length - 1);
  return t.done();
}

export function quickSort(arr: number[]): Trace {
  const t = tracer(arr);
  const part = (lo: number, hi: number): number => {
    const pivot = t.a[hi]; let i = lo;
    for (let j = lo; j < hi; j++) { t.cmp(); t.snap([j, hi]); if (t.a[j] < pivot) { if (i !== j) t.swap(i, j); i++; } }
    if (i !== hi) t.swap(i, hi); t.snap([i, hi]);
    return i;
  };
  const rec = (lo: number, hi: number) => { if (lo >= hi) return; const p = part(lo, hi); rec(lo, p - 1); rec(p + 1, hi); };
  rec(0, t.a.length - 1);
  return t.done();
}

export const ALGOS = { bubble: bubbleSort, insertion: insertionSort, selection: selectionSort, merge: mergeSort, quick: quickSort };
export type AlgoName = keyof typeof ALGOS;
