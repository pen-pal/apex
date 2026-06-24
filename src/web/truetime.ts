// TrueTime & commit-wait (Google Spanner) — how a globally-distributed database gives transactions a
// single, globally-consistent ordering using real clocks. The trick is to stop pretending the clock
// is exact. TrueTime's TT.now() returns an INTERVAL [earliest, latest] = [t−ε, t+ε]; the true instant
// is somewhere inside, with ε bounded (a few ms) by GPS + atomic clocks in every datacenter. To commit
// a transaction with external consistency — if T1 finishes before T2 begins, then ts(T1) < ts(T2) — a
// transaction picks its commit timestamp s = TT.now().latest (= t+ε, the latest it could possibly be)
// and then COMMIT-WAITs until TT.now().earliest > s before releasing its locks. That guarantees s is
// safely in the PAST everywhere, so no later transaction can ever pick an earlier timestamp. The wait
// is exactly 2ε — the price of correctness is paid in clock uncertainty. Pure model, tested.

export interface TTInterval { earliest: number; latest: number }

/** TT.now(): the bounded-uncertainty interval around the true instant. */
export const now = (trueTime: number, epsilon: number): TTInterval => ({ earliest: trueTime - epsilon, latest: trueTime + epsilon });

export interface Commit {
  commitTs: number; // s = TT.now().latest = t + ε  (the latest the true time could be)
  waitMs: number; // commit-wait duration = 2ε
  visibleAt: number; // when locks release / the commit becomes visible = t + 2ε
}

/** Choose a commit timestamp and compute the commit-wait needed to make it safely past. */
export function commitWait(trueTime: number, epsilon: number): Commit {
  return {
    commitTs: trueTime + epsilon, // pick the latest possible "now"
    waitMs: 2 * epsilon, // wait until TT.now().earliest > commitTs ⇒ trueTime + 2ε
    visibleAt: trueTime + 2 * epsilon,
  };
}

export interface ECResult { ts1: number; ts2: number; t1VisibleAt: number; ordered: boolean }

/** External consistency: T1 commits at true time t1, then T2 begins. With commit-wait, T2 can't start
 *  until T1 is visible (t1+2ε), so ts2 > ts1 always. Without it, T2 can grab an equal-or-earlier
 *  timestamp despite happening after — the anomaly commit-wait exists to prevent. */
export function externalConsistency(t1: number, t2Start: number, epsilon: number, useCommitWait: boolean): ECResult {
  const c1 = commitWait(t1, epsilon);
  const ts1 = c1.commitTs;
  const t1VisibleAt = useCommitWait ? c1.visibleAt : t1; // without commit-wait, locks release immediately at t1
  const actualT2 = Math.max(t2Start, t1VisibleAt); // T2 observes T1 only once it is visible
  const ts2 = actualT2 + epsilon; // T2 picks its own latest-now
  return { ts1, ts2, t1VisibleAt, ordered: ts1 < ts2 };
}
