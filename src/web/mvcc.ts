// MVCC — Multi-Version Concurrency Control, how PostgreSQL, Oracle, and MySQL/InnoDB let
// readers and writers run without blocking each other. Instead of overwriting a row, a
// write creates a NEW VERSION tagged with the transaction that made it (xmin) and, when
// superseded, the transaction that retired it (xmax). Each transaction runs against a
// SNAPSHOT: the set of transactions already committed when it began. A version is visible
// to a snapshot iff it was created by a transaction the snapshot can see AND not yet
// deleted by one it can see. So a long read sees a stable, consistent picture while writers
// keep producing new versions alongside — that's snapshot isolation. Pure, tested.

export interface Version { value: string; xmin: number; xmax: number | null } // creator / retirer txids
export type Store = Record<string, Version[]>;

export interface Snapshot { txid: number; committed: Set<number> } // txns committed before this snapshot began

/** A version is visible to a snapshot if its creator is visible and its retirer is not. */
function visible(v: Version, s: Snapshot): boolean {
  const creatorVisible = v.xmin === s.txid || s.committed.has(v.xmin);
  const retirerVisible = v.xmax !== null && (v.xmax === s.txid || s.committed.has(v.xmax));
  return creatorVisible && !retirerVisible;
}

export interface ReadResult { value: string | null; versionsTotal: number }

/** Read the one version of `key` visible to this snapshot. */
export function read(store: Store, key: string, snap: Snapshot): ReadResult {
  const versions = store[key] ?? [];
  const v = versions.find((ver) => visible(ver, snap));
  return { value: v ? v.value : null, versionsTotal: versions.length };
}

/** Write a new version: retire the version this txn currently sees, append the new one. */
export function write(store: Store, key: string, value: string, snap: Snapshot): void {
  const versions = store[key] ?? (store[key] = []);
  const cur = versions.find((ver) => visible(ver, snap));
  if (cur) cur.xmax = snap.txid;
  versions.unshift({ value, xmin: snap.txid, xmax: null }); // newest first
}

export const emptyStore = (): Store => ({});

/** All live versions of a key with a visibility flag for a given snapshot (for display). */
export function inspect(store: Store, key: string, snap: Snapshot): { version: Version; visible: boolean }[] {
  return (store[key] ?? []).map((version) => ({ version, visible: visible(version, snap) }));
}
