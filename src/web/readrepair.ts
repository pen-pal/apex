// Read repair — how an eventually-consistent store (Dynamo, Cassandra, Riak) quietly heals stale replicas as a
// side effect of ordinary reads. Data is replicated to N nodes, but writes don't always reach all of them
// (a node was down, a network blip, a hinted handoff not yet delivered), so replicas drift apart — different
// versions of the same key. When a client reads at consistency level R, the coordinator asks R replicas and
// gets back several versions. It returns the FRESHEST one to the client — and then, noticing that some of the
// replicas it just talked to are behind, it WRITES the fresh value back to them (the "repair"). So every read
// of a popular key nudges the cluster toward agreement, for free, without a background job. Read repair is one
// of three convergence mechanisms working together: hinted handoff (catch a write up when a node returns),
// anti-entropy (periodic Merkle-tree sync of everything), and read repair (fix-on-read for hot data). The
// catch: it only fixes the replicas a read actually TOUCHES, and if R is too small the read can miss the newest
// write entirely — which is why strong reads want R + W > N so the read set is guaranteed to overlap the write
// set. Reference: DeCandia et al., "Dynamo" (2007); the Cassandra read-repair path.

export interface Replica { id: number; value: string; version: number } // version = a logical timestamp

export interface ReadResult {
  value: string;      // freshest value found in the read set
  version: number;
  repaired: number[]; // replica ids that were stale in the read set and got written back
  sawNewest: boolean; // did the read set contain the globally-newest version? (false = a stale read slipped through)
  globalNewest: number;
}

/** Read the replicas in `readSet`, return the freshest, and repair the stale ones it touched (mutates them). */
export function read(replicas: Replica[], readSet: number[]): ReadResult {
  const inSet = replicas.filter((r) => readSet.includes(r.id));
  const newest = inSet.reduce((a, b) => (b.version > a.version ? b : a));
  const repaired: number[] = [];
  for (const r of inSet) {
    if (r.version < newest.version) { r.value = newest.value; r.version = newest.version; repaired.push(r.id); } // write-back
  }
  const globalNewest = Math.max(...replicas.map((r) => r.version));
  return { value: newest.value, version: newest.version, repaired, sawNewest: newest.version === globalNewest, globalNewest };
}

/** Apply a write to a set of replicas (the ones that were reachable), bumping their version. */
export function write(replicas: Replica[], writeSet: number[], value: string, version: number): void {
  for (const r of replicas) if (writeSet.includes(r.id)) { r.value = value; r.version = version; }
}

/** Are all replicas in agreement? */
export const converged = (replicas: Replica[]): boolean => replicas.every((r) => r.version === replicas[0].version && r.value === replicas[0].value);
