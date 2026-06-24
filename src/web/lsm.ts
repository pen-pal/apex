// LSM-tree (Log-Structured Merge tree) — the write-optimized storage engine behind
// RocksDB, LevelDB, Cassandra, and ScyllaDB. Writes never seek: a put just goes into an
// in-memory sorted MEMTABLE. When the memtable fills, it's flushed to disk as an immutable
// sorted file (an SSTABLE) and a fresh memtable starts. Reads check the memtable first,
// then the SSTables newest-to-oldest, stopping at the first hit. Deletes write a TOMBSTONE
// that shadows older values. Over time COMPACTION merges SSTables, keeping only the newest
// value per key and dropping tombstones — reclaiming space at the cost of write
// amplification. The mirror image of a B+tree: cheap writes, pricier reads. Pure, tested.

export type Value = string | null; // null = tombstone (a delete marker)
export interface SSTable { id: number; entries: [string, Value][] } // sorted by key

export interface Lsm {
  memtable: Map<string, Value>;
  sstables: SSTable[]; // newest LAST
  threshold: number;
  nextId: number;
  flushes: number;
}

export const create = (threshold = 4): Lsm => ({ memtable: new Map(), sstables: [], threshold, nextId: 0, flushes: 0 });

/** Flush the memtable to a new immutable, sorted SSTable. */
function flush(lsm: Lsm): void {
  if (lsm.memtable.size === 0) return;
  const entries = [...lsm.memtable.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  lsm.sstables.push({ id: lsm.nextId++, entries });
  lsm.memtable = new Map();
  lsm.flushes++;
}

export function put(lsm: Lsm, key: string, value: string): void {
  lsm.memtable.set(key, value);
  if (lsm.memtable.size >= lsm.threshold) flush(lsm);
}

/** Delete = write a tombstone (it shadows any older value until compaction drops it). */
export function del(lsm: Lsm, key: string): void {
  lsm.memtable.set(key, null);
  if (lsm.memtable.size >= lsm.threshold) flush(lsm);
}

export interface ReadResult { value: string | null; foundIn: string }

/** Read newest-first: memtable, then SSTables from newest to oldest. */
export function get(lsm: Lsm, key: string): ReadResult {
  if (lsm.memtable.has(key)) {
    const v = lsm.memtable.get(key)!;
    return { value: v, foundIn: v === null ? 'memtable (tombstone)' : 'memtable' };
  }
  for (let i = lsm.sstables.length - 1; i >= 0; i--) {
    const hit = lsm.sstables[i].entries.find(([k]) => k === key);
    if (hit) return { value: hit[1], foundIn: hit[1] === null ? `SSTable ${lsm.sstables[i].id} (tombstone)` : `SSTable ${lsm.sstables[i].id}` };
  }
  return { value: null, foundIn: 'not found' };
}

/** How many SSTables a read for `key` must touch before it hits (read amplification). */
export function readCost(lsm: Lsm, key: string): number {
  if (lsm.memtable.has(key)) return 0;
  let n = 0;
  for (let i = lsm.sstables.length - 1; i >= 0; i--) { n++; if (lsm.sstables[i].entries.some(([k]) => k === key)) return n; }
  return n;
}

/** Compact all SSTables into one: newest value per key wins, tombstones are dropped. */
export function compact(lsm: Lsm): void {
  const merged = new Map<string, Value>();
  for (const t of lsm.sstables) for (const [k, v] of t.entries) merged.set(k, v); // later (newer) overwrites
  const entries = [...merged.entries()].filter(([, v]) => v !== null).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  lsm.sstables = entries.length ? [{ id: lsm.nextId++, entries }] : [];
}
