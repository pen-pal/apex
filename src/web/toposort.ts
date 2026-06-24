// Topological sort (Kahn's algorithm, 1962) — order the nodes of a directed graph so every
// edge points forward: if A must come before B (A → B), A appears earlier. It's how build
// systems decide compile order, how spreadsheets recalculate cells, how package managers
// resolve dependencies, and how schedulers sequence tasks. Kahn's method: repeatedly take a
// node with no remaining prerequisites (in-degree 0), append it, and remove its outgoing
// edges — exposing the next ready nodes. If some nodes never reach in-degree 0, the graph
// has a CYCLE and no ordering exists. Pure, tested (valid orderings + cycle detection).

export interface Graph { nodes: string[]; edges: [string, string][] } // edge [a,b] means a before b

export interface Step { picked: string; readyAfter: string[] }
export interface Result { order: string[] | null; hasCycle: boolean; cycleNodes: string[]; steps: Step[] }

export function topoSort(g: Graph): Result {
  const indeg: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  for (const n of g.nodes) { indeg[n] = 0; adj[n] = []; }
  for (const [a, b] of g.edges) { adj[a].push(b); indeg[b]++; }

  // ready set = in-degree 0; pick the alphabetically-smallest each time for a deterministic order
  const ready = g.nodes.filter((n) => indeg[n] === 0).sort();
  const order: string[] = [];
  const steps: Step[] = [];

  while (ready.length) {
    const n = ready.shift()!;
    order.push(n);
    const newlyReady: string[] = [];
    for (const m of adj[n]) { if (--indeg[m] === 0) newlyReady.push(m); }
    for (const m of newlyReady.sort()) {
      // insert keeping `ready` sorted
      let i = 0; while (i < ready.length && ready[i] < m) i++;
      ready.splice(i, 0, m);
    }
    steps.push({ picked: n, readyAfter: [...ready] });
  }

  if (order.length < g.nodes.length) {
    const cycleNodes = g.nodes.filter((n) => indeg[n] > 0); // never reached in-degree 0
    return { order: null, hasCycle: true, cycleNodes, steps };
  }
  return { order, hasCycle: false, cycleNodes: [], steps };
}

/** Verify an ordering respects every edge (for testing / honesty). */
export function isValidOrder(g: Graph, order: string[]): boolean {
  const pos: Record<string, number> = {};
  order.forEach((n, i) => (pos[n] = i));
  return g.edges.every(([a, b]) => pos[a] < pos[b]);
}
