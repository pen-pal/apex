// Chord (Stoica et al., 2001) — a distributed hash table that finds which node owns a key
// in O(log n) hops, not O(n). Nodes and keys are hashed onto a ring of 2^m identifiers; a
// key is owned by its SUCCESSOR (the first node clockwise from it). Naively you'd walk
// node-to-node around the ring, but each node also keeps a FINGER TABLE: shortcuts to the
// successors of n+1, n+2, n+4, … n+2^(m-1), so a lookup can leap halfway to the target each
// hop, halving the remaining distance — O(log n). This is how P2P systems (and Cassandra's
// ring) route without any node knowing the whole membership. Pure, tested on the classic
// m=3 example.

export interface Ring { m: number; size: number; nodes: number[] } // nodes sorted ascending

export const create = (m: number, nodes: number[]): Ring =>
  ({ m, size: 1 << m, nodes: [...new Set(nodes)].sort((a, b) => a - b) });

/** Is x in the circular interval (a, b] (or [a,b) etc.) on the ring? */
function inInterval(x: number, a: number, b: number, incLeft: boolean, incRight: boolean, size: number): boolean {
  x = ((x % size) + size) % size; a = ((a % size) + size) % size; b = ((b % size) + size) % size;
  if (a === b) return incLeft || incRight || x === a; // full circle
  if (a < b) return (incLeft ? x >= a : x > a) && (incRight ? x <= b : x < b);
  return (incLeft ? x >= a : x > a) || (incRight ? x <= b : x < b); // wraps past 0
}

/** The node responsible for an identifier = first node clockwise at or after it. */
export function responsible(ring: Ring, id: number): number {
  id = ((id % ring.size) + ring.size) % ring.size;
  for (const n of ring.nodes) if (n >= id) return n;
  return ring.nodes[0]; // wrapped past the top
}

/** The next node clockwise from a node (its successor pointer). */
export function nextNode(ring: Ring, n: number): number {
  const i = ring.nodes.indexOf(n);
  return ring.nodes[(i + 1) % ring.nodes.length];
}

/** Finger table of node n: finger[i] = responsible(n + 2^i). */
export function fingerTable(ring: Ring, n: number): { start: number; node: number }[] {
  return Array.from({ length: ring.m }, (_, i) => {
    const start = (n + (1 << i)) % ring.size;
    return { start, node: responsible(ring, start) };
  });
}

/** Closest finger of n that precedes `key` on the ring (the longest safe leap). */
function closestPreceding(ring: Ring, n: number, key: number): number {
  const fingers = fingerTable(ring, n);
  for (let i = fingers.length - 1; i >= 0; i--) {
    const f = fingers[i].node;
    if (f !== n && inInterval(f, n, key, false, false, ring.size)) return f;
  }
  return n;
}

export interface Lookup { target: number; hops: number[] }

/** Route a lookup for `key` starting at `start`, returning the owner and the hop path. */
export function lookup(ring: Ring, start: number, key: number): Lookup {
  // the start node itself owns the key if it falls in (predecessor, start]
  const si = ring.nodes.indexOf(start);
  const pred = ring.nodes[(si - 1 + ring.nodes.length) % ring.nodes.length];
  if (inInterval(key, pred, start, false, true, ring.size)) return { target: start, hops: [start] };

  const hops = [start];
  let cur = start;
  for (let guard = 0; guard < ring.nodes.length + ring.m + 2; guard++) {
    const succ = nextNode(ring, cur);
    if (inInterval(key, cur, succ, false, true, ring.size)) return { target: succ, hops };
    const next = closestPreceding(ring, cur, key);
    if (next === cur) return { target: succ, hops }; // no closer finger
    cur = next; hops.push(cur);
  }
  return { target: responsible(ring, key), hops };
}
