// Write-ahead-log replication — how a database keeps copies in sync and survives a
// crash. The leader appends every change to an ordered log; each follower copies
// entries in order, lagging by some amount. The commit point is the highest entry
// stored on a QUORUM (majority). The durability knob:
//   SYNC  — a write isn't acknowledged to the client until a majority has it, so an
//           ack'd write can never be lost (durable), but the client waits for replicas.
//   ASYNC — the leader commits immediately and replicates lazily (fast), but if the
//           leader crashes, any entries the followers hadn't copied yet are LOST.
// On failover, the new leader is the most up-to-date follower; entries beyond it
// vanish. Pure, deterministic model. Tested.

export type Mode = 'sync' | 'async';

export interface ReplState {
  mode: Mode;
  log: string[]; // the leader's ordered log entries (index 0..n-1)
  followers: number[]; // each follower's replicatedIndex = # of entries it has copied
  ackedIndex: number; // # of entries acknowledged to the client (durable promise)
}

export function initRepl(mode: Mode, followerCount = 2): ReplState {
  return { mode, log: [], followers: new Array(followerCount).fill(0), ackedIndex: 0 };
}

/** Quorum over (leader + followers): a majority of the whole replica set. */
export function quorum(followerCount: number): number {
  return Math.floor((followerCount + 1) / 2) + 1;
}

/** The commit index = how many entries are stored on a quorum of replicas. */
export function commitIndex(s: ReplState): number {
  const n = s.log.length;
  for (let idx = n; idx >= 1; idx--) {
    // replicas that have at least `idx` entries: the leader (always) + matching followers
    const have = 1 + s.followers.filter((f) => f >= idx).length;
    if (have >= quorum(s.followers.length)) return idx;
  }
  return 0;
}

/** Leader appends an entry. Under async it's immediately acked; under sync, not yet. */
export function append(s: ReplState, entry: string): ReplState {
  const log = [...s.log, entry];
  const next = { ...s, log };
  // async acknowledges on the leader right away; sync waits for the quorum (see ackUpToCommit)
  return s.mode === 'async' ? { ...next, ackedIndex: log.length } : next;
}

/** A follower copies one more entry from the leader (advances its replicatedIndex). */
export function replicateOne(s: ReplState, follower: number): ReplState {
  const followers = s.followers.slice();
  if (followers[follower] < s.log.length) followers[follower] += 1;
  const next = { ...s, followers };
  return refreshAck(next);
}

/** Replicate every follower fully up to the leader's log (a catch-up round). */
export function replicateAll(s: ReplState): ReplState {
  const followers = s.followers.map(() => s.log.length);
  return refreshAck({ ...s, followers });
}

/** Under sync, the acked index follows the commit index (quorum durability). */
function refreshAck(s: ReplState): ReplState {
  if (s.mode === 'sync') return { ...s, ackedIndex: Math.max(s.ackedIndex, commitIndex(s)) };
  return s;
}

export interface FailoverResult {
  newLeaderFollower: number; // which follower is promoted (most up-to-date)
  survivedIndex: number; // entries that survive (the new leader's log length)
  lost: string[]; // entries that existed on the old leader but are gone
  ackedLost: boolean; // did we lose anything that had been acknowledged? (sync must be false)
}

/** The leader crashes: the most up-to-date follower takes over; the tail beyond it is lost. */
export function leaderCrashes(s: ReplState): FailoverResult {
  const best = s.followers.reduce((bi, f, i) => (f > s.followers[bi] ? i : bi), 0);
  const survivedIndex = s.followers[best];
  const lost = s.log.slice(survivedIndex);
  return {
    newLeaderFollower: best,
    survivedIndex,
    lost,
    ackedLost: survivedIndex < s.ackedIndex, // SYNC guarantees this is never true
  };
}
