// Longest Increasing Subsequence (LIS) via patience sorting — find the longest run of values that increase
// left to right (not necessarily contiguous). The obvious dynamic program is O(n²): for each element, the best
// subsequence ending there is 1 + the best among all smaller earlier elements. Patience sorting does it in
// O(n log n) with a lovely card-game metaphor. Deal the sequence like solitaire: place each card on the LEFTMOST
// pile whose top card is >= it, or start a new pile to the right if none qualifies (greedy). Two facts make this
// work: each pile's tops are increasing left to right, so you can find the pile with a BINARY SEARCH; and the
// NUMBER OF PILES at the end equals the LIS length (a classic result — you can't have more piles than the LIS is
// long, and the greedy placement achieves exactly that). To recover the actual subsequence, when you place a
// card, remember the current top of the pile to its left as its predecessor; following those back-pointers from
// the last pile reconstructs one longest increasing subsequence. The `tails` array the code maintains is exactly
// the pile tops: tails[k] is the smallest possible tail value of any increasing subsequence of length k+1, and
// binary-searching it for each element is the whole algorithm. LIS shows up in patience-diff (Git's histogram
// diff cousin), box stacking, and as the combinatorial heart of the Erdős–Szekeres theorem (any sequence of
// n²+1 distinct numbers has a monotone subsequence of length n+1). This models the patience piles, the O(n log n)
// binary search, and the reconstruction, cross-checked against the O(n²) DP. Reference: Schensted (1961);
// Aldous & Diaconis, "Longest increasing subsequences" (1999).

export interface LisResult { length: number; sequence: number[]; indices: number[]; pile: number[] }

/** LIS by patience sorting. `pile[i]` is the (0-based) pile card i lands on; strictly-increasing subsequence. */
export function lis(a: number[]): LisResult {
  const tailIdx: number[] = [];                 // tailIdx[k] = index of the current top of pile k
  const prev = new Array<number>(a.length).fill(-1);
  const pile = new Array<number>(a.length).fill(0);
  for (let i = 0; i < a.length; i++) {
    // lower_bound: leftmost pile whose top value >= a[i] (strict increase)
    let lo = 0, hi = tailIdx.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (a[tailIdx[mid]] < a[i]) lo = mid + 1; else hi = mid; }
    pile[i] = lo;
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;     // predecessor = current top of the pile to the left
    if (lo === tailIdx.length) tailIdx.push(i); else tailIdx[lo] = i;
  }
  const length = tailIdx.length;
  const indices: number[] = [];
  for (let k = length > 0 ? tailIdx[length - 1] : -1; k >= 0; k = prev[k]) indices.unshift(k);
  return { length, sequence: indices.map((j) => a[j]), indices, pile };
}

/** The O(n²) dynamic program — length only — for cross-checking. */
export function lisLengthDP(a: number[]): number {
  if (a.length === 0) return 0;
  const dp = a.map(() => 1);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < i; j++)
      if (a[j] < a[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
  return Math.max(...dp);
}
