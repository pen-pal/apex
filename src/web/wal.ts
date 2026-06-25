// Write-Ahead Logging (WAL) — how a database survives a crash mid-transaction (the redo/undo heart
// of ARIES-style recovery). The rule: before a change touches a data page, its log record is appended to a
// sequential, fsync'd log. So the log is the source of truth. After a crash, recovery reads
// the log and does two things: REDO every change made by a transaction that has a COMMIT
// record (durability — committed work is never lost), and UNDO every change by a
// transaction that doesn't (atomicity — a half-done transaction leaves no trace). The data
// pages themselves may have been flushed or not; the log makes the outcome deterministic.
// Pure recovery model — the redo/undo essence; ARIES's checkpointing and LSN-based dirty-page
// tracking (which bound how far back replay must start) are out of scope here. Tested.

export type Rec =
  | { lsn: number; txid: number; type: 'update'; key: string; before: string; after: string }
  | { lsn: number; txid: number; type: 'commit' };

export interface Recovery {
  final: Record<string, string>;
  committed: number[];
  aborted: number[];     // present in the log but never committed
  redone: Rec[];
  undone: Rec[];
}

/** Truncate the log at a crash point — records after `crashLsn` never reached durable storage. */
export const crashAt = (log: Rec[], crashLsn: number): Rec[] => log.filter((r) => r.lsn <= crashLsn);

/** Recover a consistent state from the surviving log. */
export function recover(log: Rec[], initial: Record<string, string>): Recovery {
  const ordered = [...log].sort((a, b) => a.lsn - b.lsn); // replay strictly in LSN order, not array order
  const committed = new Set(ordered.filter((r) => r.type === 'commit').map((r) => r.txid));
  const updates = ordered.filter((r): r is Extract<Rec, { type: 'update' }> => r.type === 'update');

  const final: Record<string, string> = { ...initial };
  const redone: Rec[] = [];
  // REDO: apply committed updates in log order (last committed write to a key wins)
  for (const u of updates) if (committed.has(u.txid)) { final[u.key] = u.after; redone.push(u); }
  // UNDO: a key touched ONLY by uncommitted txns reverts to its pre-image (its original value)
  const undone = updates.filter((u) => !committed.has(u.txid));
  for (const u of [...undone].reverse()) {
    const everCommitted = updates.some((v) => v.key === u.key && committed.has(v.txid));
    if (!everCommitted) final[u.key] = initial[u.key] ?? u.before;
  }

  const aborted = [...new Set(updates.map((u) => u.txid))].filter((t) => !committed.has(t));
  return { final, committed: [...committed], aborted, redone, undone };
}
