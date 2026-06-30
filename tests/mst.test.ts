import { describe, it, expect } from 'vitest';
import { kruskal, prim, nodes, type Edge } from '../src/web/mst';

// 5-node weighted graph, hand-solved: MST = {A-B(1), C-E(2), A-C(3), C-D(4)}, total weight 10.
const G: Edge[] = [
  { u: 'A', v: 'B', w: 1 }, { u: 'A', v: 'C', w: 3 }, { u: 'B', v: 'C', w: 3 },
  { u: 'B', v: 'D', w: 6 }, { u: 'C', v: 'D', w: 4 }, { u: 'C', v: 'E', w: 2 }, { u: 'D', v: 'E', w: 5 },
];

describe('Kruskal', () => {
  const r = kruskal(G);
  it('finds the minimum spanning tree of weight 10', () => {
    expect(r.weight).toBe(10);
    expect(r.tree).toHaveLength(nodes(G).length - 1); // 4 edges for 5 nodes
  });
  it('adds edges cheapest-first and rejects the cycle-forming B-C', () => {
    expect(r.order).toEqual(['A-B', 'C-E', 'A-C', 'C-D']);
    const bc = r.steps.find((s) => s.edge.u === 'B' && s.edge.v === 'C')!;
    expect(bc.accepted).toBe(false); // B and C already connected via A
  });
});

describe('Prim', () => {
  it('grows one tree and reaches the same total weight', () => {
    const r = prim(G, 'A');
    expect(r.weight).toBe(10);
    expect(r.tree).toHaveLength(4);
  });
  it('starting from a different node still gives the minimum weight', () => {
    expect(prim(G, 'D').weight).toBe(10);
    expect(prim(G, 'E').weight).toBe(10);
  });
});

describe('Kruskal and Prim agree', () => {
  it('both algorithms produce the same MST weight', () => {
    expect(kruskal(G).weight).toBe(prim(G).weight);
  });
  it('every spanning tree has exactly n-1 edges and connects all nodes', () => {
    const r = kruskal(G);
    const connected = new Set<string>();
    for (const e of r.tree) { connected.add(e.u); connected.add(e.v); }
    expect(connected.size).toBe(nodes(G).length);
  });
  it('a trivial triangle drops its heaviest edge', () => {
    const tri: Edge[] = [{ u: 'X', v: 'Y', w: 1 }, { u: 'Y', v: 'Z', w: 2 }, { u: 'X', v: 'Z', w: 5 }];
    expect(kruskal(tri).weight).toBe(3); // 1 + 2, drop the 5
    expect(kruskal(tri).order).toEqual(['X-Y', 'Y-Z']);
  });

  it('multi-digit weights are compared numerically, not as strings (Prim regression)', () => {
    // "10" sorts before "2" lexicographically; Prim must still prefer the weight-2 edge.
    const g: Edge[] = [{ u: 'A', v: 'B', w: 2 }, { u: 'A', v: 'C', w: 10 }, { u: 'B', v: 'C', w: 10 }];
    expect(kruskal(g).weight).toBe(12);      // {A-B(2), A-C(10)}
    expect(prim(g, 'A').weight).toBe(12);    // must agree — was 20 with the string-key bug
    expect(prim(g, 'A').weight).toBe(kruskal(g).weight);
  });
});
