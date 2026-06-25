import { describe, it, expect } from 'vitest';
import { propagate, routesTo, hijack, type AsGraph } from '../src/web/bgphijack';

// A chain with a stub: 1—2—3—4—5, and 3—6.  AS1 = legit origin, AS5 = rogue.
const g: AsGraph = { nodes: [1, 2, 3, 4, 5, 6], edges: [[1, 2], [2, 3], [3, 4], [4, 5], [3, 6]] };

describe('clean propagation', () => {
  const prop = propagate(g, [1]);
  it('gives every AS a route to the real origin', () => {
    for (const n of g.nodes) expect(routesTo(prop, n)).toBe(1);
  });
  it('builds loop-free AS_PATHs that grow with distance', () => {
    for (const n of g.nodes) {
      const p = prop.best[n].asPath;
      expect(new Set(p).size).toBe(p.length); // no AS appears twice (loop prevention)
    }
    expect(prop.best[2].asPath).toEqual([2, 1]);
    expect(prop.best[4].asPath).toEqual([4, 3, 2, 1]); // 4 hops to the origin
  });
});

describe('same-prefix hijack', () => {
  const r = hijack(g, 1, 5, false);
  it('captures the ASes closer to the rogue', () => {
    expect(r.captured).toContain(4); // AS4 is one hop from the rogue
    expect(routesTo(r.prop, 4)).toBe(5);
  });
  it('leaves the ASes closer to the real origin alone', () => {
    expect(r.legit).toContain(2); // AS2 is right next to the legit origin
    expect(routesTo(r.prop, 2)).toBe(1);
  });
  it('does not capture the whole internet — it’s a partial blackhole', () => {
    expect(r.captured.length).toBeLessThan(g.nodes.length);
    expect(r.legit.length).toBeGreaterThan(0);
  });
});

describe('more-specific hijack (longest-prefix match)', () => {
  const r = hijack(g, 1, 5, true);
  it('captures EVERY AS regardless of path length', () => {
    expect(r.captured.sort((a, b) => a - b)).toEqual(g.nodes);
    expect(r.legit).toEqual([]);
    for (const n of g.nodes) expect(routesTo(r.prop, n)).toBe(5);
  });
});

describe('determinism regardless of relaxation order', () => {
  // the same graph, but with nodes and edges listed in different orders
  it('shuffled node/edge orderings yield an identical hijack outcome', () => {
    const base = hijack(g, 1, 5, false);
    const shuffles: AsGraph[] = [
      { nodes: [6, 5, 4, 3, 2, 1], edges: [[3, 6], [4, 5], [3, 4], [2, 3], [1, 2]] },
      { nodes: [3, 1, 6, 4, 2, 5], edges: [[2, 3], [3, 6], [1, 2], [4, 5], [3, 4]] },
      { nodes: [4, 2, 6, 1, 5, 3], edges: [[4, 5], [1, 2], [3, 4], [3, 6], [2, 3]] },
    ];
    for (const sg of shuffles) {
      const r = hijack(sg, 1, 5, false);
      expect(r.captured.sort((a, b) => a - b)).toEqual(base.captured.sort((a, b) => a - b));
      expect(r.legit.sort((a, b) => a - b)).toEqual(base.legit.sort((a, b) => a - b));
    }
  });
  it('AS6 (the stub) deterministically follows AS3 to the legit origin', () => {
    // AS3 prefers [3,2,1] over [3,4,5] (lex), so AS6 = [6,3,2,1] → origin 1, never the rogue
    const r = propagate(g, [1, 5]);
    expect(r.best[6].asPath).toEqual([6, 3, 2, 1]);
    expect(routesTo(r, 6)).toBe(1);
  });
});
