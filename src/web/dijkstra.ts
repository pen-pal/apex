// Dijkstra's shortest-path algorithm with a recorded step trace, so the UI can
// animate exactly what a link-state router (OSPF, IS-IS) does: flood the link
// costs, then each router independently computes the lowest-cost tree to every
// destination. The math is real and tested against known weighted graphs.

export interface Edge { a: string; b: string; cost: number }
export interface Graph { nodes: string[]; edges: Edge[] }

/** One relaxation step, captured for visualization. */
export interface DijkstraStep {
  settled: string; // the node whose shortest distance just became final
  dist: Record<string, number>; // best-known distance to every node after this step
  prev: Record<string, string | null>; // predecessor on the best path
  relaxed: string[]; // neighbours whose tentative distance improved this step
}

export interface DijkstraResult {
  dist: Record<string, number>;
  prev: Record<string, string | null>;
  steps: DijkstraStep[];
  order: string[]; // the order nodes were settled
}

function neighbours(g: Graph, node: string): { to: string; cost: number }[] {
  const out: { to: string; cost: number }[] = [];
  for (const e of g.edges) {
    if (e.a === node) out.push({ to: e.b, cost: e.cost });
    else if (e.b === node) out.push({ to: e.a, cost: e.cost }); // links are bidirectional
  }
  return out;
}

/** Run Dijkstra from `source`, returning final distances plus a per-settle trace. */
export function dijkstra(g: Graph, source: string): DijkstraResult {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const done: Record<string, boolean> = {};
  for (const n of g.nodes) { dist[n] = Infinity; prev[n] = null; }
  dist[source] = 0;

  const steps: DijkstraStep[] = [];
  const order: string[] = [];

  while (true) {
    // pick the unsettled node with the smallest tentative distance
    let u: string | null = null;
    let best = Infinity;
    for (const n of g.nodes) {
      if (!done[n] && dist[n] < best) { best = dist[n]; u = n; }
    }
    if (u === null) break; // all reachable nodes settled
    done[u] = true;
    order.push(u);

    const relaxed: string[] = [];
    for (const { to, cost } of neighbours(g, u)) {
      if (done[to]) continue;
      const alt = dist[u] + cost;
      if (alt < dist[to]) { dist[to] = alt; prev[to] = u; relaxed.push(to); }
    }
    steps.push({ settled: u, dist: { ...dist }, prev: { ...prev }, relaxed });
  }

  return { dist, prev, steps, order };
}

/** Reconstruct the shortest path source→target from a result's predecessors. */
export function shortestPath(result: DijkstraResult, source: string, target: string): string[] | null {
  if (result.dist[target] === Infinity) return null; // unreachable
  const path: string[] = [];
  let cur: string | null = target;
  while (cur !== null) {
    path.unshift(cur);
    if (cur === source) return path;
    cur = result.prev[cur] ?? null;
  }
  return path[0] === source ? path : null;
}

/** The set of undirected edges that make up a path, as "a|b" keys (a<b sorted). */
export function pathEdgeKeys(path: string[]): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i + 1 < path.length; i++) {
    const [a, b] = [path[i], path[i + 1]].sort();
    keys.add(`${a}|${b}`);
  }
  return keys;
}
