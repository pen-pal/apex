import { describe, it, expect } from 'vitest';
import { floydWarshall, nodesOf, type DiEdge } from '../src/web/floyd';

// A→B 3, B→C 1, A→C 7, C→D 2, B→D 5 — hand-solved all-pairs distances.
const G: DiEdge[] = [
  { from: 'A', to: 'B', w: 3 }, { from: 'B', to: 'C', w: 1 }, { from: 'A', to: 'C', w: 7 },
  { from: 'C', to: 'D', w: 2 }, { from: 'B', to: 'D', w: 5 },
];

describe('Floyd-Warshall all-pairs shortest paths', () => {
  const r = floydWarshall(G);
  const d = (a: string, b: string) => r.dist[r.nodes.indexOf(a)][r.nodes.indexOf(b)];

  it('finds every hand-verified shortest distance', () => {
    expect(d('A', 'B')).toBe(3);
    expect(d('A', 'C')).toBe(4); // A→B→C (4) beats direct A→C (7)
    expect(d('A', 'D')).toBe(6); // A→B→C→D (3+1+2)
    expect(d('B', 'D')).toBe(3); // B→C→D (3) beats direct B→D (5)
    expect(d('C', 'D')).toBe(2);
  });
  it('diagonal is 0 and unreachable pairs stay Infinity', () => {
    expect(d('A', 'A')).toBe(0);
    expect(d('D', 'A')).toBe(Infinity); // no path backwards
  });
  it('records one matrix per intermediate vertex k, plus the initial', () => {
    expect(r.steps).toHaveLength(r.nodes.length + 1);
    expect(r.steps[0].k).toBeNull();
  });
  it('no negative cycle in a positive-weight graph', () => {
    expect(r.negativeCycle).toBe(false);
  });
});

describe('negative edges and cycles', () => {
  it('handles a negative edge that Dijkstra could not', () => {
    const r = floydWarshall([{ from: 'X', to: 'Y', w: 4 }, { from: 'Y', to: 'Z', w: -2 }, { from: 'X', to: 'Z', w: 5 }]);
    const d = (a: string, b: string) => r.dist[r.nodes.indexOf(a)][r.nodes.indexOf(b)];
    expect(d('X', 'Z')).toBe(2); // X→Y→Z (4−2) beats direct 5
    expect(r.negativeCycle).toBe(false);
  });
  it('detects a negative cycle (a vertex reaches itself at negative cost)', () => {
    const r = floydWarshall([{ from: 'P', to: 'Q', w: 1 }, { from: 'Q', to: 'P', w: -3 }]);
    expect(r.negativeCycle).toBe(true);
  });
  it('the intermediate step actually relaxes a two-hop path', () => {
    const r = floydWarshall(G);
    const ai = r.nodes.indexOf('A'), ci = r.nodes.indexOf('C');
    expect(r.steps[0].dist[ai][ci]).toBe(7);                 // before any waypoint: direct edge
    expect(r.steps[r.steps.length - 1].dist[ai][ci]).toBe(4); // after: via B
  });
});

describe('nodesOf', () => {
  it('collects and sorts vertices, including isolated extras', () => {
    expect(nodesOf(G, ['Z'])).toEqual(['A', 'B', 'C', 'D', 'Z']);
  });
});
