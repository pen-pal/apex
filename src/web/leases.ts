// Leases — a lock with an expiry date, so a crashed holder doesn't freeze the system forever. Instead of "hold
// this lock until you explicitly release it" (and if you die, everyone waits), a lease says "you're the leader
// for the next D seconds; after that it's automatically up for grabs." No cleanup needed when a node crashes —
// the lease just expires. This is how leader election stays live in Chubby, ZooKeeper, GFS chunk leases, and
// Raft/etcd leader leases. The catch is SAFETY: you must never have two nodes both believing they hold the
// lease at the same wall-clock instant (split brain — two leaders, two writers, corruption). And that depends
// on CLOCKS. If the current holder's clock runs slow, it thinks its lease is still valid after the granter has
// already declared it expired and handed a fresh lease to someone else — an overlap where BOTH act as leader.
// The defense is a guard interval: the granter waits out the maximum possible clock skew (plus message delay)
// before re-granting, so the old holder has provably self-expired first. This file models exactly that
// safety condition. Reference: Gray & Cheriton, "Leases" (1989); the Chubby & Raft lease designs.

export interface LeaseParams {
  duration: number;   // lease length D (granter's clock)
  clockSkew: number;  // how much the holder's clock lags real time → how long it over-holds
  netDelay: number;   // grant/renew message delay the holder may fail to subtract
  guardInterval: number; // extra time the granter waits after expiry before re-granting
}

export interface LeaseResult {
  granterExpiry: number;       // when the granter considers the lease done
  holderBelievesUntil: number; // when the OLD holder actually stops acting (its clock is slow / delay)
  newGrantAt: number;          // when the granter hands the lease to the next node
  overlap: number;             // wall-clock time during which BOTH think they hold it (0 = safe)
  safe: boolean;
}

/** Analyze a lease hand-off on a common (true) timeline where t=0 is the original grant. */
export function analyze(p: LeaseParams): LeaseResult {
  const granterExpiry = p.duration;
  // the holder over-holds by its clock skew plus any message delay it didn't account for
  const holderBelievesUntil = p.duration + p.clockSkew + p.netDelay;
  const newGrantAt = p.duration + p.guardInterval; // granter waits the guard before re-granting
  const overlap = Math.max(0, holderBelievesUntil - newGrantAt);
  return { granterExpiry, holderBelievesUntil, newGrantAt, overlap, safe: overlap === 0 };
}

/** The smallest guard interval that guarantees no split brain for these skew/delay assumptions. */
export const minSafeGuard = (p: Pick<LeaseParams, 'clockSkew' | 'netDelay'>): number => p.clockSkew + p.netDelay;
