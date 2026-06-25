// Raft log replication (Ongaro & Ousterhout, "In Search of an Understandable Consensus Algorithm",
// §5.3–5.4) — how an elected leader makes every follower's log identical, and decides when an entry is
// safely COMMITTED. Three ideas:
//   • Log Matching: AppendEntries carries (prevLogIndex, prevLogTerm). A follower accepts only if its
//     log has that entry — proving the two logs agree up to that point. If not, it rejects, and the
//     leader BACKS UP nextIndex and retries until a match is found, then overwrites the follower's
//     divergent suffix. So agreement at the tip implies agreement on the whole prefix.
//   • Commit by majority: the leader advances commitIndex to N once a MAJORITY of logs hold entry N.
//   • The §5.4.2 safety rule: a leader may only commit entries from its OWN current term by counting
//     replicas. A leftover entry from a previous term is committed only INDIRECTLY, once a current-term
//     entry above it commits — this is the subtle fix for the Figure-8 anomaly where a majority-stored
//     entry could otherwise be overwritten. Pure model of the log mechanics, tested against the paper.

export interface Entry { term: number; cmd: string }

export interface AppendResult { ok: boolean; log: Entry[]; reason: string }

/** AppendEntries log-matching check + append (§5.3). prevLogIndex = -1 means "from the start". */
export function appendEntries(followerLog: Entry[], prevLogIndex: number, prevLogTerm: number, entries: Entry[]): AppendResult {
  if (prevLogIndex >= 0) {
    if (followerLog.length <= prevLogIndex || followerLog[prevLogIndex].term !== prevLogTerm) {
      return { ok: false, log: followerLog, reason: `no entry matching index ${prevLogIndex}/term ${prevLogTerm} → reject` };
    }
  }
  const merged = followerLog.slice(0, prevLogIndex + 1); // drop any conflicting suffix
  for (const e of entries) merged.push(e);
  return { ok: true, log: merged, reason: 'log-matching passed → appended (divergent suffix overwritten)' };
}

export interface SyncResult { log: Entry[]; nextIndexTried: number[]; rounds: number }

/** Bring one follower into sync: start optimistically at the leader's tip and back nextIndex up on each
 *  rejection until the consistency check passes, then replicate the rest (§5.3). */
export function syncFollower(leaderLog: Entry[], followerLog: Entry[]): SyncResult {
  const nextIndexTried: number[] = [];
  let nextIndex = leaderLog.length;
  for (let attempt = 0; attempt <= leaderLog.length + 1; attempt++) {
    const prevLogIndex = nextIndex - 1;
    const prevLogTerm = prevLogIndex >= 0 ? leaderLog[prevLogIndex].term : 0;
    nextIndexTried.push(nextIndex);
    const r = appendEntries(followerLog, prevLogIndex, prevLogTerm, leaderLog.slice(nextIndex));
    if (r.ok) return { log: r.log, nextIndexTried, rounds: attempt + 1 };
    nextIndex--;
  }
  return { log: followerLog, nextIndexTried, rounds: -1 };
}

/** The highest index the leader may mark committed: a MAJORITY hold it AND it is from the current term
 *  (§5.4.2). Everything at or below that index is then committed by the Log Matching property. */
export function commitIndex(logs: Entry[][], currentTerm: number): number {
  const majority = Math.floor(logs.length / 2) + 1;
  const leaderLog = logs[0];
  let commit = -1;
  for (let i = 0; i < leaderLog.length; i++) {
    if (leaderLog[i].term !== currentTerm) continue; // may NOT commit prior-term entries by counting
    const replicas = logs.filter((lg) => lg.length > i && lg[i].term === leaderLog[i].term).length;
    if (replicas >= majority) commit = i;
  }
  return commit;
}
