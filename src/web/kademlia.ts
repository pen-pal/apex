// Kademlia — the distributed hash table that actually runs the decentralized internet: BitTorrent's Mainline
// DHT, IPFS, Ethereum's node discovery, and I2P all use it. Like any DHT it maps keys to the nodes responsible
// for them across a peer-to-peer network with no central directory, and lets any node find the node closest to
// a key in O(log n) hops while knowing only O(log n) peers. Kademlia's trick is its distance metric: the
// "distance" between two IDs is their bitwise XOR, read as a number. XOR distance is symmetric (d(a,b)=d(b,a))
// and, crucially, has a tree structure — two IDs are close exactly when they share a long binary PREFIX. That
// lets every node organize its contacts into k-BUCKETS: bucket i holds up to k peers whose XOR distance falls
// in [2^i, 2^{i+1}), i.e. peers that first differ from you at bit i. You know many nearby peers and
// exponentially fewer distant ones — O(log n) contacts total. To look up a target key, you ask the α closest
// peers you know; each replies with the closest peers IT knows; you keep the overall-closest and repeat,
// halving the remaining distance each round until it converges on the node nearest the key. Because XOR is a
// proper metric with the prefix property, each hop fixes another leading bit and the search provably converges.
// This models IDs, XOR distance, k-bucket routing tables, and the iterative lookup. Reference: Maymounkov &
// Mazières, "Kademlia" (2002).

export const BITS = 8; // ID space 0..255 for legibility (real Kademlia uses 160)

export const distance = (a: number, b: number): number => (a ^ b) >>> 0;

/** Which k-bucket a peer falls in, relative to `node`: the position of the highest set bit of the XOR distance. */
export function bucketIndex(node: number, peer: number): number {
  const d = distance(node, peer);
  return d === 0 ? -1 : 31 - Math.clz32(d);
}

/** Length of the shared leading-bit prefix of two IDs — longer prefix = closer. */
export function sharedPrefix(a: number, b: number): number {
  const d = distance(a, b);
  return d === 0 ? BITS : BITS - 1 - (31 - Math.clz32(d));
}

/** A node's routing table: up to k peers per bucket, the k closest in each. */
export function routingTable(node: number, network: number[], k: number): number[] {
  const buckets = new Map<number, number[]>();
  for (const peer of network) {
    if (peer === node) continue;
    const bi = bucketIndex(node, peer);
    (buckets.get(bi) ?? buckets.set(bi, []).get(bi)!).push(peer);
  }
  const known: number[] = [];
  for (const peers of buckets.values()) {
    peers.sort((x, y) => distance(node, x) - distance(node, y));
    known.push(...peers.slice(0, k));
  }
  return known;
}

export interface LookupResult { path: number[]; result: number; hops: number }

/** Iterative lookup: repeatedly query the α closest-to-target known peers, merging their contacts, until the
 *  closest node stops improving. Returns the query path and the closest node found. */
export function lookup(network: number[], target: number, start: number, k: number, alpha = 3): LookupResult {
  const tables = new Map<number, number[]>();
  const tableOf = (n: number) => tables.get(n) ?? tables.set(n, routingTable(n, network, k)).get(n)!;

  const known = new Set<number>([start, ...tableOf(start)]);
  const queried = new Set<number>();
  const path: number[] = [];
  let closest = [...known].reduce((a, b) => (distance(b, target) < distance(a, target) ? b : a), start);

  for (;;) {
    const toQuery = [...known].filter((n) => !queried.has(n)).sort((a, b) => distance(a, target) - distance(b, target)).slice(0, alpha);
    if (toQuery.length === 0) break;
    for (const node of toQuery) { queried.add(node); path.push(node); for (const peer of tableOf(node)) known.add(peer); }
    const newClosest = [...known].reduce((a, b) => (distance(b, target) < distance(a, target) ? b : a), closest);
    if (distance(newClosest, target) >= distance(closest, target)) break; // no improvement → converged
    closest = newClosest;
  }
  return { path, result: closest, hops: path.length };
}

/** The true nearest node to a target (ground truth). */
export const nearest = (network: number[], target: number): number =>
  network.reduce((a, b) => (distance(b, target) < distance(a, target) ? b : a));
