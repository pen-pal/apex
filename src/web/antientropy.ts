// Read-repair & anti-entropy — how a Dynamo-style replicated store heals divergence without a leader.
// Replicas drift apart (a write missed some nodes during a partition). Two mechanisms reconcile them:
//   • READ-REPAIR (synchronous, on the hot path): a quorum read gathers R copies; if their versions
//     disagree, the coordinator returns the newest and writes it back to the stale replicas it saw.
//     Cheap, but only fixes keys that are actually read.
//   • ANTI-ENTROPY (background): two replicas compare MERKLE TREES of their whole keyspace. Equal
//     roots ⇒ identical, in one comparison. Differing roots ⇒ recurse only into the subtrees whose
//     hashes differ, walking down to the exact divergent keys in O(log n) work per difference instead
//     of shipping and comparing every key. This is how Cassandra/Riak/DynamoDB repair replicas.
// Real deterministic hashing (FNV-1a + a node combiner); production uses SHA-256. Pure, tested.

// ---- read-repair --------------------------------------------------------------------------------

export interface Replica { id: string; value: string; version: number }
export interface ReadResult { winner: string; winningVersion: number; stale: string[]; repaired: boolean }

/** A quorum read over the first R replicas: newest version wins, older replicas are repaired. */
export function quorumRead(replicas: Replica[], R: number): ReadResult {
  const quorum = replicas.slice(0, R);
  if (quorum.length === 0) return { winner: '', winningVersion: -1, stale: [], repaired: false }; // no replicas answered
  const newest = quorum.reduce((a, b) => (b.version > a.version ? b : a));
  const stale = quorum.filter((r) => r.version < newest.version).map((r) => r.id);
  return { winner: newest.value, winningVersion: newest.version, stale, repaired: stale.length > 0 };
}

// ---- anti-entropy via Merkle trees --------------------------------------------------------------

export interface MerkleNode { hash: number; lo: number; hi: number; left?: MerkleNode; right?: MerkleNode }

const fnv1a = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
const combine = (l: number, r: number): number => (Math.imul(l ^ r, 0x01000193) ^ ((l + r) >>> 0)) >>> 0;

/** Per-key content hash (the Merkle leaves) — the keyspace, padded to a power of two. */
export function leafHashes(values: string[]): number[] {
  let n = 1; while (n < values.length) n *= 2;
  const out = new Array(n).fill(0);
  for (let i = 0; i < values.length; i++) out[i] = fnv1a(values[i]);
  return out;
}

export function buildMerkle(leaves: number[]): MerkleNode {
  const build = (lo: number, hi: number): MerkleNode => {
    if (lo === hi) return { hash: leaves[lo], lo, hi };
    const mid = (lo + hi) >> 1;
    const left = build(lo, mid), right = build(mid + 1, hi);
    return { hash: combine(left.hash, right.hash), lo, hi, left, right };
  };
  return build(0, leaves.length - 1);
}

export interface DiffResult { differingLeaves: number[]; comparisons: number }

/** Compare two Merkle trees, recursing only where hashes differ. Returns the divergent leaf indices
 *  and how many node comparisons it took (vs comparing all n leaves outright). */
export function merkleDiff(a: MerkleNode, b: MerkleNode): DiffResult {
  // the lockstep recursion assumes identical tree shape; if two replicas built trees over different
  // key counts (different depth), conservatively flag the whole covered range rather than mispair nodes.
  if (a.lo !== b.lo || a.hi !== b.hi) {
    const lo = Math.min(a.lo, b.lo), hi = Math.max(a.hi, b.hi);
    return { differingLeaves: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), comparisons: 1 };
  }
  const differingLeaves: number[] = [];
  let comparisons = 0;
  const rec = (na: MerkleNode, nb: MerkleNode) => {
    comparisons++;
    if (na.hash === nb.hash) return; // whole subtree matches — skip it entirely
    if (!na.left || !nb.left) { differingLeaves.push(na.lo); return; } // a divergent leaf
    rec(na.left, nb.left); rec(na.right!, nb.right!);
  };
  rec(a, b);
  return { differingLeaves, comparisons };
}
