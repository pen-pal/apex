// Floyd-Warshall — shortest paths between EVERY pair of vertices, in one cubic dynamic program. The
// idea is a single relaxation rule applied for each "intermediate" vertex k in turn: the shortest path
// from i to j using only {0..k} as waypoints is either the best you had using {0..k-1}, or the best
// path i→k spliced onto k→j. Run k over all vertices and the table holds every shortest distance. It
// handles negative edges (unlike Dijkstra) and detects a negative cycle as a vertex whose distance to
// itself drops below zero. Reference: CLRS ch.25.2; Floyd 1962, Warshall 1962.

export type Matrix = number[][];
export interface DiEdge { from: string; to: string; w: number }
export interface FloydResult { nodes: string[]; steps: { k: number | null; dist: Matrix }[]; dist: Matrix; negativeCycle: boolean }

export function nodesOf(edges: DiEdge[], extra: string[] = []): string[] {
  const s = new Set<string>(extra);
  for (const e of edges) { s.add(e.from); s.add(e.to); }
  return [...s].sort();
}

const clone = (m: Matrix): Matrix => m.map((r) => [...r]);

export function floydWarshall(edges: DiEdge[], extra: string[] = []): FloydResult {
  const nodes = nodesOf(edges, extra);
  const idx: Record<string, number> = Object.fromEntries(nodes.map((n, i) => [n, i]));
  const n = nodes.length;
  const dist: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  for (const e of edges) dist[idx[e.from]][idx[e.to]] = Math.min(dist[idx[e.from]][idx[e.to]], e.w); // keep the cheapest parallel edge

  const steps: { k: number | null; dist: Matrix }[] = [{ k: null, dist: clone(dist) }];
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (dist[i][k] === Infinity) continue;
      for (let j = 0; j < n; j++) {
        const through = dist[i][k] + dist[k][j];
        if (through < dist[i][j]) dist[i][j] = through;
      }
    }
    steps.push({ k, dist: clone(dist) });
  }
  const negativeCycle = nodes.some((_, i) => dist[i][i] < 0);
  return { nodes, steps, dist, negativeCycle };
}
