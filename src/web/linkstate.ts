// Link-state routing (OSPF) — the paradigm opposite to distance-vector. Instead of telling neighbors
// its ROUTES, every router floods a Link-State Advertisement describing only its own directly-attached
// links. Flooding is reliable and hop-by-hop, so after a few rounds EVERY router holds the identical
// link-state database (LSDB) — the complete map of the network. Each router then independently runs
// Dijkstra (the SPF, shortest-path-first, computation) over that map to build its routing table. No
// router ever trusts another's path math, which is why link-state converges without the count-to-
// infinity of distance-vector. Reference: RFC 2328 (OSPFv2) §12-13 (LSAs/flooding) and §16 (SPF).

export interface Link { a: string; b: string; cost: number } // undirected
export type Topology = Link[];

export function routers(topo: Topology): string[] {
  const set = new Set<string>();
  for (const l of topo) { set.add(l.a); set.add(l.b); }
  return [...set].sort();
}

/** Each router's directly-attached links — this is the content of the LSA it originates. */
export function neighbors(topo: Topology, node: string): { node: string; cost: number }[] {
  const out: { node: string; cost: number }[] = [];
  for (const l of topo) {
    if (l.a === node) out.push({ node: l.b, cost: l.cost });
    else if (l.b === node) out.push({ node: l.a, cost: l.cost });
  }
  return out.sort((x, y) => (x.node < y.node ? -1 : 1));
}

export interface FloodResult { rounds: number; converged: boolean; have: Record<string, string[]> }

/** Simulate reliable flooding: each router starts knowing only its OWN LSA, and each round adopts any
 *  LSA a neighbour already holds. Returns the number of rounds until every LSDB is the full topology. */
export function flood(topo: Topology): FloodResult {
  const all = routers(topo);
  const have: Record<string, Set<string>> = {};
  for (const r of all) have[r] = new Set([r]); // a router originates (knows) its own LSA

  let rounds = 0;
  for (let guard = 0; guard < all.length + 2; guard++) {
    let changed = false;
    const snapshot: Record<string, Set<string>> = {};
    for (const r of all) snapshot[r] = new Set(have[r]);
    for (const r of all) {
      for (const nb of neighbors(topo, r)) {
        for (const lsa of snapshot[nb.node]) {
          if (!have[r].has(lsa)) { have[r].add(lsa); changed = true; }
        }
      }
    }
    if (!changed) break;
    rounds++;
  }
  const have2: Record<string, string[]> = {};
  for (const r of all) have2[r] = [...have[r]].sort();
  const converged = all.every((r) => have[r].size === all.length);
  return { rounds, converged, have: have2 };
}

export interface Route { dest: string; cost: number; nextHop: string | null; path: string[] }

/** Dijkstra's SPF over the full LSDB from `source`, yielding cost, first-hop and full path per router. */
export function spf(topo: Topology, source: string): Record<string, Route> {
  const all = routers(topo);
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const r of all) { dist[r] = Infinity; prev[r] = null; }
  dist[source] = 0;
  const unvisited = new Set(all);

  while (unvisited.size) {
    // pick the unvisited node of least tentative distance (ties: lexicographic, for determinism)
    let u: string | null = null;
    for (const r of unvisited) if (u === null || dist[r] < dist[u] || (dist[r] === dist[u] && r < u)) u = r;
    if (u === null || dist[u] === Infinity) break;
    unvisited.delete(u);
    for (const nb of neighbors(topo, u)) {
      const alt = dist[u] + nb.cost;
      if (alt < dist[nb.node] || (alt === dist[nb.node] && u < (prev[nb.node] ?? '￿'))) {
        dist[nb.node] = alt; prev[nb.node] = u;
      }
    }
  }

  const routes: Record<string, Route> = {};
  for (const dest of all) {
    if (dest === source) { routes[dest] = { dest, cost: 0, nextHop: null, path: [source] }; continue; }
    const path: string[] = [];
    let cur: string | null = dest;
    while (cur !== null) { path.unshift(cur); cur = prev[cur]; }
    const nextHop = path.length >= 2 && path[0] === source ? path[1] : null;
    routes[dest] = { dest, cost: dist[dest], nextHop, path: path[0] === source ? path : [] };
  }
  return routes;
}
