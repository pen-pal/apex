// Strongly connected components — the maximal groups of vertices where every node can reach every
// other, found by Kosaraju's beautifully simple two-pass DFS. Pass 1: DFS the graph, pushing each node
// onto a stack as it FINISHES. Pass 2: DFS the TRANSPOSE (all edges reversed), taking roots in reverse-
// finish order; each DFS tree is one SCC. Why it works: the reverse-finish order visits a "sink" SCC of
// the original first in the transpose, so a DFS there can't escape it. Collapsing each SCC to a point
// yields the CONDENSATION, which is always a DAG — the cycle structure of any digraph, made acyclic.
// Reference: CLRS ch.22.5; Kosaraju (unpublished) / Sharir 1981.

export interface DiEdge { from: string; to: string }
export interface SccResult { components: string[][]; compOf: Record<string, number>; condensation: [number, number][] }

const adjacency = (nodes: string[], edges: DiEdge[], reverse: boolean) => {
  const adj: Record<string, string[]> = Object.fromEntries(nodes.map((n) => [n, []]));
  for (const e of edges) (reverse ? adj[e.to].push(e.from) : adj[e.from].push(e.to));
  for (const n of nodes) adj[n].sort();
  return adj;
};

export function nodesOf(edges: DiEdge[]): string[] {
  const s = new Set<string>();
  for (const e of edges) { s.add(e.from); s.add(e.to); }
  return [...s].sort();
}

export function kosaraju(edges: DiEdge[], extraNodes: string[] = []): SccResult {
  const nodes = [...new Set([...nodesOf(edges), ...extraNodes])].sort();
  const adj = adjacency(nodes, edges, false);
  const radj = adjacency(nodes, edges, true);

  // pass 1 — push nodes in order of DFS finish time
  const seen = new Set<string>();
  const order: string[] = [];
  const dfs1 = (u: string) => { seen.add(u); for (const v of adj[u]) if (!seen.has(v)) dfs1(v); order.push(u); };
  for (const n of nodes) if (!seen.has(n)) dfs1(n);

  // pass 2 — DFS the transpose in reverse-finish order; each tree is one SCC
  const compOf: Record<string, number> = {};
  const components: string[][] = [];
  const assigned = new Set<string>();
  for (let i = order.length - 1; i >= 0; i--) {
    const root = order[i];
    if (assigned.has(root)) continue;
    const members: string[] = [];
    const stack = [root];
    assigned.add(root);
    while (stack.length) {
      const u = stack.pop()!;
      members.push(u);
      for (const v of radj[u]) if (!assigned.has(v)) { assigned.add(v); stack.push(v); }
    }
    members.sort();
    for (const m of members) compOf[m] = components.length;
    components.push(members);
  }

  // condensation: one edge per distinct cross-component pair
  const seenEdge = new Set<string>();
  const condensation: [number, number][] = [];
  for (const e of edges) {
    const a = compOf[e.from], b = compOf[e.to];
    if (a !== b && !seenEdge.has(`${a}-${b}`)) { seenEdge.add(`${a}-${b}`); condensation.push([a, b]); }
  }
  return { components, compOf, condensation };
}

/** True iff the condensation has no directed cycle (it always should — that's the theorem). */
export function isDag(result: SccResult): boolean {
  const n = result.components.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of result.condensation) adj[a].push(b);
  const state = new Array(n).fill(0); // 0 unvisited, 1 in-stack, 2 done
  const dfs = (u: number): boolean => {
    state[u] = 1;
    for (const v of adj[u]) { if (state[v] === 1) return false; if (state[v] === 0 && !dfs(v)) return false; }
    state[u] = 2; return true;
  };
  for (let i = 0; i < n; i++) if (state[i] === 0 && !dfs(i)) return false;
  return true;
}
