import { describe, it, expect } from 'vitest';
import { bellmanFord, detectArbitrage, type Edge, type Rate } from '../src/web/bellmanford';

// CLRS Fig 24.4: nodes s=0, t=1, x=2, y=3, z=4. Negative edges but NO negative cycle.
const CLRS: Edge[] = [
  { u: 0, v: 1, w: 6 }, { u: 0, v: 3, w: 7 },
  { u: 1, v: 2, w: 5 }, { u: 1, v: 3, w: 8 }, { u: 1, v: 4, w: -4 },
  { u: 2, v: 1, w: -2 },
  { u: 3, v: 2, w: -3 }, { u: 3, v: 4, w: 9 },
  { u: 4, v: 0, w: 2 }, { u: 4, v: 2, w: 7 },
];

describe('Bellman–Ford shortest paths with negative edges', () => {
  it('computes the canonical CLRS distances (Dijkstra would get these wrong)', () => {
    const r = bellmanFord(5, CLRS, 0);
    expect(r.dist).toEqual([0, 2, 4, 7, -2]);
    expect(r.hasNegativeCycle).toBe(false);
    expect(r.negativeCycle).toBeNull();
  });

  it('marks unreachable nodes as Infinity', () => {
    const r = bellmanFord(3, [{ u: 0, v: 1, w: 5 }], 0); // node 2 unreachable
    expect(r.dist[2]).toBe(Infinity);
  });

  it('records a relaxation snapshot per pass for the animation', () => {
    const r = bellmanFord(5, CLRS, 0);
    expect(r.rounds.length).toBeGreaterThan(0);
    expect(r.rounds.length).toBeLessThanOrEqual(4); // at most V-1 passes
    expect(r.rounds[r.rounds.length - 1]).toEqual([0, 2, 4, 7, -2]); // last snapshot == final dist
  });
});

describe('negative-cycle detection', () => {
  it('detects a reachable negative cycle and reconstructs it', () => {
    // 0→1→2→0 with total weight 1 + (-1) + (-1) = -1 < 0
    const edges: Edge[] = [{ u: 0, v: 1, w: 1 }, { u: 1, v: 2, w: -1 }, { u: 2, v: 0, w: -1 }];
    const r = bellmanFord(3, edges, 0);
    expect(r.hasNegativeCycle).toBe(true);
    expect(r.negativeCycle).not.toBeNull();
    const cyc = r.negativeCycle!;
    expect(cyc[0]).toBe(cyc[cyc.length - 1]); // closed loop
    expect(new Set(cyc).size).toBe(3); // visits all three distinct nodes
  });

  it('a positive-only cycle is NOT flagged', () => {
    const edges: Edge[] = [{ u: 0, v: 1, w: 1 }, { u: 1, v: 2, w: 1 }, { u: 2, v: 0, w: 1 }];
    expect(bellmanFord(3, edges, 0).hasNegativeCycle).toBe(false);
  });
});

describe('currency arbitrage detection', () => {
  const currencies = ['USD', 'EUR', 'GBP'];

  it('finds a profitable loop (rates multiply to > 1)', () => {
    // USD→EUR→GBP→USD = 0.9 * 0.9 * 1.3 = 1.053 > 1
    const rates: Rate[] = [
      { from: 'USD', to: 'EUR', rate: 0.9 }, { from: 'EUR', to: 'GBP', rate: 0.9 }, { from: 'GBP', to: 'USD', rate: 1.3 },
    ];
    const arb = detectArbitrage(currencies, rates);
    expect(arb).not.toBeNull();
    expect(arb!.profit).toBeCloseTo(1.053, 3);
    expect(arb!.profit).toBeGreaterThan(1);
    expect(new Set(arb!.cycle)).toEqual(new Set(['USD', 'EUR', 'GBP']));
  });

  it('reports no arbitrage when every loop loses to the spread', () => {
    // round trips lose: 0.9 * 1.1 = 0.99 < 1 either way
    const rates: Rate[] = [
      { from: 'USD', to: 'EUR', rate: 0.9 }, { from: 'EUR', to: 'USD', rate: 1.1 },
    ];
    expect(detectArbitrage(['USD', 'EUR'], rates)).toBeNull();
  });
});
