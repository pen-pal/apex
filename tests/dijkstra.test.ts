import { describe, it, expect } from 'vitest';
import { dijkstra, shortestPath, pathEdgeKeys, type Graph } from '../src/web/dijkstra';

// A small graph with hand-verified shortest paths.
//   A--1--B--2--C
//   |     |     |
//   4     5     1
//   |     |     |
//   D--1--E--3--F
const G: Graph = {
  nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
  edges: [
    { a: 'A', b: 'B', cost: 1 }, { a: 'B', b: 'C', cost: 2 },
    { a: 'A', b: 'D', cost: 4 }, { a: 'B', b: 'E', cost: 5 }, { a: 'C', b: 'F', cost: 1 },
    { a: 'D', b: 'E', cost: 1 }, { a: 'E', b: 'F', cost: 3 },
  ],
};

describe('dijkstra distances', () => {
  it('computes the correct shortest distances from A', () => {
    const r = dijkstra(G, 'A');
    expect(r.dist).toEqual({ A: 0, B: 1, C: 3, D: 4, E: 5, F: 4 });
  });
  it('settles nodes in nondecreasing distance order', () => {
    const r = dijkstra(G, 'A');
    const ds = r.order.map((n) => r.dist[n]);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThanOrEqual(ds[i - 1]);
  });
  it('records a step per settled node, with cumulative distances', () => {
    const r = dijkstra(G, 'A');
    expect(r.steps).toHaveLength(6);
    expect(r.steps[0].settled).toBe('A');
    expect(r.steps[0].relaxed.sort()).toEqual(['B', 'D']); // A's neighbours improve first
    expect(r.steps[r.steps.length - 1].dist).toEqual(r.dist);
  });
});

describe('shortestPath', () => {
  it('reconstructs A→F as the cheapest route (A-B-C-F = 4, beats A-D-E-F = 8)', () => {
    const r = dijkstra(G, 'A');
    expect(shortestPath(r, 'A', 'F')).toEqual(['A', 'B', 'C', 'F']);
  });
  it('reroutes when a link cost changes', () => {
    // Make B–C expensive; now A→F should prefer A-D-E-F.
    const g2: Graph = { ...G, edges: G.edges.map((e) => (e.a === 'B' && e.b === 'C' ? { ...e, cost: 20 } : e)) };
    const r = dijkstra(g2, 'A');
    expect(shortestPath(r, 'A', 'F')).toEqual(['A', 'D', 'E', 'F']);
    expect(r.dist.F).toBe(8);
  });
  it('returns null for an unreachable node', () => {
    const g3: Graph = { nodes: ['A', 'B', 'X'], edges: [{ a: 'A', b: 'B', cost: 1 }] };
    const r = dijkstra(g3, 'A');
    expect(shortestPath(r, 'A', 'X')).toBeNull();
    expect(r.dist.X).toBe(Infinity);
  });
});

describe('pathEdgeKeys', () => {
  it('produces sorted undirected edge keys', () => {
    expect([...pathEdgeKeys(['A', 'B', 'C', 'F'])]).toEqual(['A|B', 'B|C', 'C|F']);
  });
});
