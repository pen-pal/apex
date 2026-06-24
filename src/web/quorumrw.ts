// Tunable quorum consistency (the Dynamo / Cassandra dial). Data is replicated to N
// nodes. A write must be acknowledged by W of them; a read must gather R of them. The
// single inequality that makes reads see the latest write is R + W > N: by pigeonhole,
// any set of R nodes and any set of W nodes out of N must share at least one node — and
// that shared node holds the freshest value. A second inequality, 2W > N, makes two
// concurrent writes always overlap, so there's a single ordering and no split-brain.
// Turning R and W up and down trades read latency for write latency for consistency.
// Pure and tested against the canonical Dynamo configurations.

export interface Config { n: number; r: number; w: number }

export interface Analysis {
  overlap: number;          // guaranteed read∩write nodes = max(0, R + W − N)
  strongRead: boolean;      // R + W > N  → a read always sees the latest ack'd write
  writeConflictFree: boolean; // 2W > N    → two writes always overlap (one order, no split-brain)
  readLoad: number;         // nodes touched per read
  writeLoad: number;        // nodes touched per write
  profile: string;
}

export function analyze({ n, r, w }: Config): Analysis {
  const overlap = Math.max(0, r + w - n);
  const strongRead = r + w > n;
  const writeConflictFree = 2 * w > n;
  let profile: string;
  if (!strongRead) profile = 'Eventually consistent — fast everywhere, but a read may miss a recent write.';
  else if (w >= n) profile = 'Read-optimized — reads are cheap (small R), but a single down node blocks writes.';
  else if (r === 1) profile = 'Read-optimized — R=1 reads are fastest; writes pay the larger W.';
  else if (w === 1) profile = 'Write-optimized — W=1 writes are fastest; reads pay the larger R.';
  else profile = 'Balanced — majority R and W (the common default), tolerant and strongly consistent.';
  return { overlap, strongRead, writeConflictFree, readLoad: r, writeLoad: w, profile };
}

/** Does a concrete read set intersect a concrete write set? (Pigeonhole guarantees yes
 *  whenever R + W > N, regardless of which nodes were chosen.) */
export function intersects(readSet: number[], writeSet: number[]): number[] {
  const w = new Set(writeSet);
  return readSet.filter((n) => w.has(n));
}

/** The adversarial worst case: push the read window as far from the write window as
 *  possible on a ring of N nodes, and report the forced overlap. */
export function worstCase({ n, r, w }: Config): { writeSet: number[]; readSet: number[]; shared: number[] } {
  const writeSet = Array.from({ length: w }, (_, i) => i);
  // start the read window at the highest indices, wrapping — minimises deliberate overlap
  const readSet = Array.from({ length: r }, (_, i) => (n - 1 - i + n) % n).sort((a, b) => a - b);
  return { writeSet, readSet, shared: intersects(readSet, writeSet) };
}
