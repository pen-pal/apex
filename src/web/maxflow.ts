// Max-flow / min-cut — how much can flow from a source to a sink through a capacitated network, and
// the bottleneck that limits it. Edmonds-Karp (Ford-Fulkerson with a BFS, so it always augments along
// a SHORTEST residual path) repeatedly finds an augmenting path and pushes its bottleneck capacity,
// updating residual capacities (including the reverse "cancelling" edges) until no path remains. The
// max-flow MIN-CUT theorem then falls out for free: the set S of nodes still reachable from the source
// in the final residual graph defines a cut, and the capacity of the edges crossing it EQUALS the max
// flow. Anchored to the canonical CLRS network (max flow = 23). Reference: CLRS ch.26; Edmonds-Karp 1972.

export interface Edge { u: string; v: string; cap: number }
export interface AugStep { path: string[]; bottleneck: number; totalAfter: number; flows: Record<string, number> }
export interface MaxFlowResult { maxFlow: number; steps: AugStep[]; minCutS: string[]; cutEdges: Edge[]; flows: Record<string, number> }

const ekey = (u: string, v: string) => `${u}->${v}`;

export function maxflow(edges: Edge[], source: string, sink: string): MaxFlowResult {
  const nodes = new Set<string>();
  const res = new Map<string, Map<string, number>>();
  const ensure = (n: string) => { if (!res.has(n)) res.set(n, new Map()); nodes.add(n); };
  for (const e of edges) {
    ensure(e.u); ensure(e.v);
    res.get(e.u)!.set(e.v, (res.get(e.u)!.get(e.v) ?? 0) + e.cap);
    if (!res.get(e.v)!.has(e.u)) res.get(e.v)!.set(e.u, 0); // reverse residual edge starts at 0
  }

  // BFS for a shortest augmenting path with positive residual capacity.
  const bfs = (): string[] | null => {
    const prev = new Map<string, string>();
    const seen = new Set([source]);
    const q = [source];
    while (q.length) {
      const u = q.shift()!;
      if (u === sink) break;
      for (const [v, c] of res.get(u) ?? []) {
        if (c > 0 && !seen.has(v)) { seen.add(v); prev.set(v, u); q.push(v); }
      }
    }
    if (!seen.has(sink)) return null;
    const path: string[] = [sink];
    let cur = sink;
    while (cur !== source) { cur = prev.get(cur)!; path.unshift(cur); }
    return path;
  };

  const origCap = new Map<string, number>();
  for (const e of edges) origCap.set(ekey(e.u, e.v), (origCap.get(ekey(e.u, e.v)) ?? 0) + e.cap);
  const flowsNow = (): Record<string, number> => {
    const f: Record<string, number> = {};
    for (const e of edges) {
      const k = ekey(e.u, e.v);
      if (f[k] === undefined) f[k] = (origCap.get(k) ?? 0) - (res.get(e.u)!.get(e.v) ?? 0);
    }
    return f;
  };

  const steps: AugStep[] = [];
  let total = 0;
  let path = bfs();
  while (path) {
    let bottleneck = Infinity;
    for (let i = 0; i + 1 < path.length; i++) bottleneck = Math.min(bottleneck, res.get(path[i])!.get(path[i + 1])!);
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i], b = path[i + 1];
      res.get(a)!.set(b, res.get(a)!.get(b)! - bottleneck);
      res.get(b)!.set(a, (res.get(b)!.get(a) ?? 0) + bottleneck);
    }
    total += bottleneck;
    steps.push({ path, bottleneck, totalAfter: total, flows: flowsNow() });
    path = bfs();
  }

  // min cut: nodes reachable from source in the final residual graph
  const S = new Set([source]);
  const stack = [source];
  while (stack.length) {
    const u = stack.pop()!;
    for (const [v, c] of res.get(u) ?? []) if (c > 0 && !S.has(v)) { S.add(v); stack.push(v); }
  }
  const cutEdges = edges.filter((e) => S.has(e.u) && !S.has(e.v));
  return { maxFlow: total, steps, minCutS: [...S].sort(), cutEdges, flows: flowsNow() };
}
