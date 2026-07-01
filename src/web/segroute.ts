// Segment Routing (SR / SPRING) — modern source routing that steers a packet along a chosen path by writing a
// small STACK of waypoints ("segments") into its header, instead of asking every router in the middle to hold
// per-flow state (the way old RSVP-TE/MPLS traffic engineering did). Each segment is an instruction. The two
// basic kinds: a NODE segment ("get to router X" — every router forwards it along the shortest path toward X,
// so it's a globally-known label), and an ADJACENCY segment ("from here, take this specific link" — a local
// label that forces one hop, even a non-shortest one). The source picks a path, encodes it as an ordered
// segment list, and pushes it onto the packet; each router looks at the top segment, forwards toward it, and
// pops it once reached. The realized route is just the concatenation of the shortest paths between consecutive
// segments (with adjacency segments forcing exact links). The payoff: arbitrary traffic engineering — send this
// flow the scenic way to dodge a congested link — with state only at the edge, nothing to sign up the core for.
// This models the topology, shortest paths, and segment-list expansion. Reference: RFC 8402 (SR architecture);
// RFC 8660 (SR-MPLS).

export type Graph = Record<string, Record<string, number>>; // undirected weighted adjacency
export type Segment = { type: 'node'; node: string } | { type: 'adj'; from: string; to: string };

/** Dijkstra shortest paths from `src`. */
export function dijkstra(g: Graph, src: string): { dist: Record<string, number>; prev: Record<string, string> } {
  const dist: Record<string, number> = {}, prev: Record<string, string> = {}, done = new Set<string>();
  for (const n in g) dist[n] = Infinity;
  dist[src] = 0;
  for (;;) {
    let u: string | null = null, best = Infinity;
    for (const n in g) if (!done.has(n) && dist[n] < best) { best = dist[n]; u = n; }
    if (u === null) break;
    done.add(u);
    for (const v in g[u]) { const nd = dist[u] + g[u][v]; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; } }
  }
  return { dist, prev };
}

/** The shortest-path node sequence from src to dst (empty if unreachable). */
export function shortestPath(g: Graph, src: string, dst: string): string[] {
  if (src === dst) return [src];
  const { dist, prev } = dijkstra(g, src);
  if (dist[dst] === Infinity) return [];
  const path: string[] = []; let n: string | undefined = dst;
  while (n !== undefined) { path.unshift(n); if (n === src) break; n = prev[n]; }
  return path[0] === src ? path : [];
}

export interface SrResult { hops: string[]; cost: number; valid: boolean }

/** Expand a segment list starting at `start` into the realized hop-by-hop path. */
export function srPath(g: Graph, start: string, segments: Segment[]): SrResult {
  let current = start; const hops = [start]; let cost = 0;
  const walk = (path: string[]): boolean => {
    if (!path.length || path[0] !== current) return false;
    for (let i = 1; i < path.length; i++) { cost += g[path[i - 1]][path[i]]; hops.push(path[i]); }
    current = path[path.length - 1];
    return true;
  };
  for (const seg of segments) {
    if (seg.type === 'node') {
      if (!walk(shortestPath(g, current, seg.node))) return { hops, cost, valid: false };
    } else {
      if (current !== seg.from && !walk(shortestPath(g, current, seg.from))) return { hops, cost, valid: false };
      if (g[current]?.[seg.to] === undefined) return { hops, cost, valid: false }; // not a real link
      cost += g[current][seg.to]; hops.push(seg.to); current = seg.to;
    }
  }
  return { hops, cost, valid: true };
}

/** Total weight of a node sequence, or Infinity if any hop isn't an edge. */
export function pathCost(g: Graph, path: string[]): number {
  let c = 0;
  for (let i = 1; i < path.length; i++) { const w = g[path[i - 1]]?.[path[i]]; if (w === undefined) return Infinity; c += w; }
  return c;
}
