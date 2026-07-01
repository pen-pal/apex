// HAMT — Hash Array Mapped Trie, the data structure behind persistent/immutable maps (Clojure, Scala,
// immutable.js, Erlang maps). Two ideas combine. First, a TRIE keyed by a hash: chop the key's 32-bit hash
// into 5-bit chunks (0..31) and use one chunk per level to descend — so lookups are O(log32 n), effectively
// constant for real sizes. Second, each node is SPARSE: instead of a 32-slot array (mostly empty), it stores a
// 32-bit bitmap of which slots are occupied plus a dense array of only those children; slot i's position in
// the array is popcount(bitmap & (bit_i − 1)). That keeps nodes tiny. The payoff is PERSISTENCE: "updating"
// the map never mutates it — set() copies only the nodes along the path from the root to the changed leaf and
// reuses (shares) every other subtree unchanged. You get a brand-new root that coexists with the old one, both
// valid, sharing almost all their memory. That's how immutable collections give you cheap copies and safe
// concurrency. This models a real HAMT with bitmap nodes, popcount indexing, and path-copying set().
// Reference: Bagwell, "Ideal Hash Trees" (2001).

const BITS = 5, MASK = 31;

export interface Entry { key: string; value: number }
export interface Node { bitmap: number; children: (Node | Entry)[] } // children aligned to the set bits, ascending
const isEntry = (x: Node | Entry): x is Entry => 'key' in x;
export const emptyNode = (): Node => ({ bitmap: 0, children: [] });

export function popcount(x: number): number { x = x >>> 0; let n = 0; while (x) { n += x & 1; x >>>= 1; } return n; }

/** FNV-1a 32-bit hash of a string — deterministic. */
export function hash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h = (h ^ key.charCodeAt(i)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

export function get(node: Node, key: string): number | undefined {
  const h = hash(key);
  let n: Node = node, shift = 0;
  for (;;) {
    const bit = 1 << ((h >>> shift) & MASK);
    if (!(n.bitmap & bit)) return undefined;
    const child = n.children[popcount(n.bitmap & (bit - 1))];
    if (isEntry(child)) return child.key === key ? child.value : undefined;
    n = child; shift += BITS;
    if (shift > 30) return undefined; // exhausted the hash (deep collision)
  }
}

// Push two entries with colliding hash-chunks down into fresh sub-nodes until their chunks differ.
function merge(e1: Entry, e2: Entry, h1: number, h2: number, shift: number): Node {
  const i1 = (h1 >>> shift) & MASK, i2 = (h2 >>> shift) & MASK;
  if (i1 === i2) {
    if (shift > 30) return { bitmap: 1 << i1, children: [e1] }; // total hash collision: keep first (demo limit)
    return { bitmap: 1 << i1, children: [merge(e1, e2, h1, h2, shift + BITS)] };
  }
  return { bitmap: (1 << i1) | (1 << i2), children: i1 < i2 ? [e1, e2] : [e2, e1] };
}

/** Immutable insert/update: returns a NEW root that shares every subtree not on the path to `key`. */
export function set(node: Node, key: string, value: number): Node {
  const h = hash(key);
  const go = (n: Node, shift: number): Node => {
    const bit = 1 << ((h >>> shift) & MASK);
    const pos = popcount(n.bitmap & (bit - 1));
    if (!(n.bitmap & bit)) { // empty slot → drop the entry in
      const children = n.children.slice(); children.splice(pos, 0, { key, value });
      return { bitmap: n.bitmap | bit, children };
    }
    const child = n.children[pos];
    let next: Node | Entry;
    if (isEntry(child)) next = child.key === key ? { key, value } : merge(child, { key, value }, hash(child.key), h, shift + BITS);
    else next = go(child, shift + BITS);
    const children = n.children.slice(); children[pos] = next; // copy THIS node only
    return { bitmap: n.bitmap, children };
  };
  return go(node, 0);
}

/** Collect all key/value pairs (order is hash-defined, not insertion order). */
export function entries(node: Node): Entry[] {
  const out: Entry[] = [];
  const walk = (n: Node) => { for (const c of n.children) isEntry(c) ? out.push(c) : walk(c); };
  walk(node);
  return out;
}

/** Structural-sharing metric: after set(), how many nodes of the NEW tree are the very same objects reused
 *  from the OLD tree (shared) vs freshly copied along the update path. */
export function sharedNodes(oldRoot: Node, newRoot: Node): { shared: number; copied: number; total: number } {
  const oldSet = new Set<Node>();
  const collect = (n: Node) => { oldSet.add(n); for (const c of n.children) if (!isEntry(c)) collect(c); };
  collect(oldRoot);
  let shared = 0, copied = 0;
  const walk = (n: Node) => {
    if (oldSet.has(n)) { shared += countNodes(n); return; } // reused subtree → all its nodes are shared
    copied++;
    for (const c of n.children) if (!isEntry(c)) walk(c);
  };
  walk(newRoot);
  return { shared, copied, total: shared + copied };
}
function countNodes(n: Node): number { let c = 1; for (const ch of n.children) if (!isEntry(ch)) c += countNodes(ch); return c; }
