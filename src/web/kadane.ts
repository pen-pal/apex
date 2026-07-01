// Kadane's algorithm — the maximum-subarray problem solved in a single left-to-right pass. Given a list of
// numbers (daily profit/loss, signal samples, sensor deltas), find the CONTIGUOUS run with the largest sum.
// The brute force checks every start/end pair — O(n²). Kadane's insight collapses it to O(n): walk the array
// keeping one running total, "the best sum of a subarray ENDING at the current position." Extending that run
// by the next element is worth it only if the running total is still positive; the moment it would drop below
// just starting fresh at the new element, you throw the old prefix away and start a new run. A negative prefix
// can never help a future subarray, so you never need to look back. Track the best total ever seen (and where
// it started/ended) and you have the answer. It's the textbook example of dynamic programming with O(1) state,
// and it generalizes to 2-D (max submatrix) and to a stock-trading "best single buy/sell" framing.
// Reference: Bentley, "Programming Pearls" (Kadane's algorithm).

export interface Step { i: number; val: number; cur: number; best: number; curStart: number; reset: boolean }
export interface KadaneResult { maxSum: number; start: number; end: number; steps: Step[] }

export function kadane(a: number[]): KadaneResult {
  if (a.length === 0) return { maxSum: 0, start: -1, end: -1, steps: [] };
  let cur = a[0], best = a[0], curStart = 0, bestStart = 0, bestEnd = 0;
  const steps: Step[] = [{ i: 0, val: a[0], cur, best, curStart, reset: false }];
  for (let i = 1; i < a.length; i++) {
    const reset = a[i] > cur + a[i];        // starting fresh beats extending → drop the (negative) prefix
    if (reset) { cur = a[i]; curStart = i; }
    else cur = cur + a[i];
    if (cur > best) { best = cur; bestStart = curStart; bestEnd = i; }
    steps.push({ i, val: a[i], cur, best, curStart, reset });
  }
  return { maxSum: best, start: bestStart, end: bestEnd, steps };
}

/** Brute force O(n²) — the ground truth. */
export function brute(a: number[]): number {
  if (a.length === 0) return 0;
  let best = -Infinity;
  for (let i = 0; i < a.length; i++) { let s = 0; for (let j = i; j < a.length; j++) { s += a[j]; if (s > best) best = s; } }
  return best;
}
