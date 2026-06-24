// Fencing tokens — why a distributed lock alone can't protect a resource, and how a
// monotonically-increasing token fixes it (Martin Kleppmann's well-known example). A lock
// service hands a client exclusive access, but the client might pause (a long GC, a network
// stall) past its lease, during which the lock is granted to someone else. When the first
// client wakes it still "thinks" it holds the lock and writes — corrupting data. The fix:
// the lock service stamps each grant with an ever-increasing FENCING TOKEN, and the resource
// remembers the highest token it has accepted and REJECTS any write carrying a smaller one.
// So a resumed, stale client is fenced out. Pure model of the scenario, tested.

export interface LockService { nextToken: number }
export const lockService = (): LockService => ({ nextToken: 1 });
export function acquire(ls: LockService): number { return ls.nextToken++; } // monotonic grants

export interface Resource { highestToken: number; value: string | null; log: string[] }
export const resource = (): Resource => ({ highestToken: 0, value: null, log: [] });

export interface WriteResult { accepted: boolean; reason: string }

/** A guarded write: accepted only if its fencing token is ≥ the highest already seen. */
export function write(r: Resource, token: number, value: string, fencingOn = true): WriteResult {
  if (fencingOn && token < r.highestToken) {
    r.log.push(`✗ token ${token} < ${r.highestToken} — REJECTED (stale)`);
    return { accepted: false, reason: `token ${token} is older than ${r.highestToken}` };
  }
  r.highestToken = Math.max(r.highestToken, token);
  r.value = value;
  r.log.push(`✓ token ${token} accepted → value = "${value}"`);
  return { accepted: true, reason: `accepted at token ${token}` };
}

export interface Event { actor: string; token: number; value: string }

/** The split-brain scenario: client A acquires, pauses; B acquires & writes; A resumes &
 *  writes with its now-stale token. Returns the resource state with and without fencing. */
export function splitBrainScenario(): { withFencing: Resource; withoutFencing: Resource; events: Event[] } {
  const ls = lockService();
  const tokenA = acquire(ls); // A gets 1, then pauses (long GC)
  const tokenB = acquire(ls); // lease expired → B gets 2 and proceeds
  const events: Event[] = [
    { actor: 'Client B', token: tokenB, value: 'B-data' }, // B writes first (A is paused)
    { actor: 'Client A (resumed, stale)', token: tokenA, value: 'A-data' }, // A wakes up and writes
  ];
  const withFencing = resource(), withoutFencing = resource();
  for (const e of events) { write(withFencing, e.token, e.value, true); write(withoutFencing, e.token, e.value, false); }
  return { withFencing, withoutFencing, events };
}
