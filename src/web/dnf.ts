// Dutch National Flag — Dijkstra's elegant one-pass, in-place partition of an array into THREE groups, named
// after the red-white-blue flag. Given values from {0, 1, 2}, sort them so all 0s come first, then all 1s, then
// all 2s — in a single left-to-right sweep, O(n) time, O(1) extra space, with at most n swaps total.
// The trick is three pointers that carve the array into four regions: [0s | 1s | unknown | 2s]. `low` marks the
// end of the 0s, `high` marks the start of the 2s, and `mid` scans the unknown region. Look at a[mid]: if it's
// a 0, swap it down into the 0s region (low++, mid++); if it's a 1, it's already in place (mid++); if it's a 2,
// swap it up into the 2s region (high--) — and DON'T advance mid, because the element you just swapped in from
// the top is still unexamined. When mid passes high, the unknown region is empty and you're done. Beyond the
// cute flag, this is the partition step of THREE-WAY QUICKSORT: partition around a pivot into (< pivot),
// (== pivot), (> pivot), which makes quicksort robust to inputs full of duplicate keys (where classic two-way
// quicksort degrades to O(n²)). Reference: Dijkstra, "A Discipline of Programming" (1976).

export interface Step { arr: number[]; low: number; mid: number; high: number; action: 'swap-low' | 'skip' | 'swap-high' }

/** Sort an array of {0,1,2} in one pass; returns the result and a step trace for visualization. */
export function sort(input: number[]): { result: number[]; steps: Step[] } {
  const a = input.slice();
  let low = 0, mid = 0, high = a.length - 1;
  const steps: Step[] = [];
  while (mid <= high) {
    if (a[mid] === 0) {
      [a[low], a[mid]] = [a[mid], a[low]];
      steps.push({ arr: a.slice(), low, mid, high, action: 'swap-low' });
      low++; mid++;
    } else if (a[mid] === 1) {
      steps.push({ arr: a.slice(), low, mid, high, action: 'skip' });
      mid++;
    } else {
      [a[mid], a[high]] = [a[high], a[mid]];
      steps.push({ arr: a.slice(), low, mid, high, action: 'swap-high' });
      high--;
    }
  }
  return { result: a, steps };
}

/** The generalized partition step of 3-way quicksort: reorder `a` into (<pivot)(==pivot)(>pivot).
 *  Returns the boundaries [lt, gt): a[lt..gt-1] are all == pivot. */
export function threeWayPartition(input: number[], pivot: number): { arr: number[]; lt: number; gt: number } {
  const a = input.slice();
  let lt = 0, i = 0, gt = a.length;
  while (i < gt) {
    if (a[i] < pivot) { [a[lt], a[i]] = [a[i], a[lt]]; lt++; i++; }
    else if (a[i] > pivot) { gt--; [a[i], a[gt]] = [a[gt], a[i]]; }
    else i++;
  }
  return { arr: a, lt, gt };
}
