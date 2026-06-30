import { describe, it, expect } from 'vitest';
import { flood, spf, neighbors, routers, type Topology } from '../src/web/linkstate';

// A 4-router topology with hand-computed shortest paths:
//   A-B 1, A-C 4, B-C 2, B-D 7, C-D 3
const TOPO: Topology = [
  { a: 'A', b: 'B', cost: 1 }, { a: 'A', b: 'C', cost: 4 },
  { a: 'B', b: 'C', cost: 2 }, { a: 'B', b: 'D', cost: 7 }, { a: 'C', b: 'D', cost: 3 },
];

describe('topology helpers', () => {
  it('lists routers and each router\'s own links (its LSA content)', () => {
    expect(routers(TOPO)).toEqual(['A', 'B', 'C', 'D']);
    expect(neighbors(TOPO, 'B')).toEqual([{ node: 'A', cost: 1 }, { node: 'C', cost: 2 }, { node: 'D', cost: 7 }]);
  });
});

describe('LSA flooding converges every LSDB to the full topology', () => {
  const r = flood(TOPO);
  it('after flooding, every router holds every LSA (identical databases)', () => {
    expect(r.converged).toBe(true);
    for (const router of routers(TOPO)) expect(r.have[router]).toEqual(['A', 'B', 'C', 'D']);
  });
  it('converges in 2 rounds for this 4-router graph', () => {
    expect(r.rounds).toBe(2); // round1: A/D learn 2-hop LSAs; round2: A,D complete; round3 no change
  });
});

describe('SPF (Dijkstra) over the LSDB', () => {
  const routes = spf(TOPO, 'A');
  it('computes the hand-verified shortest costs from A', () => {
    expect(routes['B'].cost).toBe(1); // direct
    expect(routes['C'].cost).toBe(3); // A-B-C (3) beats direct A-C (4)
    expect(routes['D'].cost).toBe(6); // A-B-C-D (1+2+3) beats A-B-D (8) and A-C-D (7)
  });
  it('routes via the correct first hop and full path', () => {
    expect(routes['C'].nextHop).toBe('B');
    expect(routes['C'].path).toEqual(['A', 'B', 'C']);
    expect(routes['D'].nextHop).toBe('B');
    expect(routes['D'].path).toEqual(['A', 'B', 'C', 'D']);
  });
  it('the source routes to itself at cost 0', () => {
    expect(routes['A']).toEqual({ dest: 'A', cost: 0, nextHop: null, path: ['A'] });
  });
  it('every router computes the SAME costs from the shared LSDB (symmetry check)', () => {
    // cost A→D from A equals cost D→A from D (undirected links)
    expect(spf(TOPO, 'A')['D'].cost).toBe(spf(TOPO, 'D')['A'].cost);
  });
});
