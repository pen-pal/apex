import { describe, it, expect } from 'vitest';
import { shortestPath, srPath, pathCost, dijkstra, type Graph } from '../src/web/segroute';

const build = (edges: Record<string, number>): Graph => {
  const g: Graph = {};
  for (const k in edges) { const [a, b] = k.split('-'); (g[a] ??= {}); (g[b] ??= {}); g[a][b] = edges[k]; g[b][a] = edges[k]; }
  return g;
};
const G = build({ 'A-B': 1, 'A-C': 4, 'B-C': 1, 'B-D': 2, 'C-E': 1, 'D-E': 3, 'D-F': 2, 'E-F': 1, 'E-G': 2, 'F-G': 1 });

describe('shortest path', () => {
  it('finds the least-cost route', () => {
    expect(shortestPath(G, 'A', 'G')).toEqual(['A', 'B', 'C', 'E', 'G']);
    expect(pathCost(G, shortestPath(G, 'A', 'G'))).toBe(5);
    expect(shortestPath(G, 'A', 'A')).toEqual(['A']);
  });
});

describe('segment-list expansion', () => {
  it('a single node segment equals the plain shortest path', () => {
    const r = srPath(G, 'A', [{ type: 'node', node: 'G' }]);
    expect(r.valid).toBe(true);
    expect(r.hops).toEqual(['A', 'B', 'C', 'E', 'G']);
    expect(r.cost).toBe(5);
  });
  it('a waypoint steers the packet a longer way (traffic engineering)', () => {
    const r = srPath(G, 'A', [{ type: 'node', node: 'D' }, { type: 'node', node: 'G' }]);
    expect(r.hops).toEqual(['A', 'B', 'D', 'F', 'G']); // via D, avoiding C-E
    expect(r.cost).toBe(6);
    expect(r.cost).toBeGreaterThan(pathCost(G, shortestPath(G, 'A', 'G'))); // deliberately non-shortest
  });
  it('an adjacency segment forces a specific link, even a costly one', () => {
    const r = srPath(G, 'A', [{ type: 'adj', from: 'A', to: 'C' }, { type: 'node', node: 'G' }]);
    expect(r.hops).toEqual(['A', 'C', 'E', 'G']);
    expect(r.cost).toBe(7); // forced the weight-4 A-C link
  });
  it('every realized hop is a real edge and the cost is the sum of weights', () => {
    const r = srPath(G, 'A', [{ type: 'node', node: 'F' }, { type: 'node', node: 'C' }]);
    expect(r.valid).toBe(true);
    expect(pathCost(G, r.hops)).toBe(r.cost);
  });
  it('rejects an adjacency segment for a link that does not exist', () => {
    expect(srPath(G, 'A', [{ type: 'adj', from: 'A', to: 'G' }]).valid).toBe(false);
  });
});

describe('dijkstra agrees with a brute-force all-paths search on random graphs', () => {
  it('200 random weighted graphs', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const bruteDist = (g: Graph, src: string, dst: string): number => {
      // uniform-cost search
      let best = Infinity; const stack: [string, number][] = [[src, 0]]; const seen: Record<string, number> = {};
      while (stack.length) {
        const [u, d] = stack.pop()!;
        if (d >= (seen[u] ?? Infinity)) continue; seen[u] = d;
        if (u === dst) { best = Math.min(best, d); continue; }
        for (const v in g[u]) stack.push([v, d + g[u][v]]);
      }
      return best;
    };
    for (let t = 0; t < 200; t++) {
      const names = ['A', 'B', 'C', 'D', 'E', 'F'];
      const g: Graph = {}; names.forEach((n) => (g[n] = {}));
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        if (rnd(2) === 0) { const w = 1 + rnd(9); g[names[i]][names[j]] = w; g[names[j]][names[i]] = w; }
      }
      const { dist } = dijkstra(g, 'A');
      for (const d of names) {
        const expected = d === 'A' ? 0 : bruteDist(g, 'A', d);
        expect(dist[d]).toBe(expected === Infinity ? Infinity : expected);
      }
    }
  });
});
