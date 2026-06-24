// Boyer-Moore majority vote (1981) — find the element that appears more than half the time
// in a stream, using a single pass and O(1) memory. The intuition is pairwise cancellation:
// keep a candidate and a counter; each matching element is a vote for the candidate, each
// differing element a vote against (and when the counter hits zero, the next element becomes
// the new candidate). A true majority (> n/2) can never be fully cancelled out, so it
// survives as the candidate. Because the trick also "survives" when no majority exists, a
// second pass must verify the candidate actually clears n/2. Pure, tested.

export interface Step { value: number; candidate: number; count: number; action: 'adopt' | 'vote+' | 'vote-' }

export interface Result {
  candidate: number | null;
  steps: Step[];
  isMajority: boolean; // does the candidate actually appear > n/2 times?
  actualCount: number;
  threshold: number;   // ⌊n/2⌋
}

export function majorityVote(stream: number[]): Result {
  let candidate = 0, count = 0;
  const steps: Step[] = [];
  for (const value of stream) {
    let action: Step['action'];
    if (count === 0) { candidate = value; count = 1; action = 'adopt'; }
    else if (value === candidate) { count++; action = 'vote+'; }
    else { count--; action = 'vote-'; }
    steps.push({ value, candidate, count, action });
  }
  // verify: the algorithm always yields a candidate, but only a real majority clears n/2
  const cand = stream.length ? candidate : null;
  const actualCount = cand === null ? 0 : stream.filter((x) => x === cand).length;
  const threshold = Math.floor(stream.length / 2);
  return { candidate: cand, steps, isMajority: actualCount > threshold, actualCount, threshold };
}
