// Minimum spanning tree — the cheapest set of edges that connects every node, and the two classic
// greedy algorithms that find it. Kruskal sorts ALL edges and adds the next cheapest that doesn't form
// a cycle (using union-find to test connectivity). Prim grows ONE tree outward, repeatedly adding the
// cheapest edge that leaves the tree. Both are greedy and both are optimal — the cut property guarantees
// the lightest edge crossing any cut is safe — so they always reach the same total weight (the edge set
// is unique when weights are distinct). Reference: CLRS ch.23; Kruskal 1956, Prim 1957.

export interface Edge { u: string; v: string; w: number }
export interface KruskalStep { edge: Edge; accepted: boolean; reason: string }
export interface MstResult { tree: Edge[]; weight: number; steps: KruskalStep[]; order: string[] }

export function nodes(edges: Edge[]): string[] {
  const s = new Set<string>();
  for (const e of edges) { s.add(e.u); s.add(e.v); }
  return [...s].sort();
}

// --- Kruskal: sort edges, union-find to reject cycles ---------------------------
class DSU {
  parent: Record<string, string> = {};
  find(x: string): string { while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; } return x; }
  union(a: string, b: string): boolean { const ra = this.find(a), rb = this.find(b); if (ra === rb) return false; this.parent[ra] = rb; return true; }
}

export function kruskal(edges: Edge[]): MstResult {
  const dsu = new DSU();
  for (const n of nodes(edges)) dsu.parent[n] = n;
  const sorted = [...edges].sort((a, b) => a.w - b.w || (a.u + a.v < b.u + b.v ? -1 : 1));
  const tree: Edge[] = [];
  const steps: KruskalStep[] = [];
  for (const e of sorted) {
    const ok = dsu.union(e.u, e.v);
    steps.push({ edge: e, accepted: ok, reason: ok ? 'connects two components' : 'would form a cycle — skip' });
    if (ok) tree.push(e);
  }
  return { tree, weight: tree.reduce((a, e) => a + e.w, 0), steps, order: tree.map((e) => `${e.u}-${e.v}`) };
}

// --- Prim: grow one tree from a start node --------------------------------------
export function prim(edges: Edge[], start?: string): MstResult {
  const ns = nodes(edges);
  const src = start ?? ns[0];
  const inTree = new Set([src]);
  const tree: Edge[] = [];
  const steps: KruskalStep[] = [];
  while (inTree.size < ns.length) {
    // cheapest edge with exactly one endpoint in the tree (deterministic tie-break)
    let best: Edge | null = null;
    for (const e of edges) {
      const a = inTree.has(e.u), b = inTree.has(e.v);
      if (a !== b) {
        const key = (x: Edge) => `${x.w}-${[x.u, x.v].sort().join('')}`;
        if (!best || key(e) < key(best)) best = e;
      }
    }
    if (!best) break; // disconnected graph
    inTree.add(inTree.has(best.u) ? best.v : best.u);
    tree.push(best);
    steps.push({ edge: best, accepted: true, reason: 'cheapest edge leaving the tree' });
  }
  return { tree, weight: tree.reduce((a, e) => a + e.w, 0), steps, order: tree.map((e) => `${e.u}-${e.v}`) };
}
