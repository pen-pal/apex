import { describe, it, expect } from 'vitest';
import { maxflow, type Edge } from '../src/web/maxflow';

// The canonical CLRS max-flow network (Figure 26.1), whose maximum flow is the published value 23.
const CLRS: Edge[] = [
  { u: 's', v: 'v1', cap: 16 }, { u: 's', v: 'v2', cap: 13 },
  { u: 'v1', v: 'v3', cap: 12 }, { u: 'v2', v: 'v1', cap: 4 },
  { u: 'v3', v: 'v2', cap: 9 }, { u: 'v2', v: 'v4', cap: 14 },
  { u: 'v4', v: 'v3', cap: 7 }, { u: 'v3', v: 't', cap: 20 }, { u: 'v4', v: 't', cap: 4 },
];

describe('Edmonds-Karp on the canonical CLRS network', () => {
  const r = maxflow(CLRS, 's', 't');

  it('finds the published maximum flow of 23', () => {
    expect(r.maxFlow).toBe(23);
  });

  it('the max-flow min-cut theorem holds: cut capacity equals max flow', () => {
    const cutCap = r.cutEdges.reduce((a, e) => a + e.cap, 0);
    expect(cutCap).toBe(23);
    expect(r.minCutS).toContain('s');
    expect(r.minCutS).not.toContain('t');
  });

  it('respects capacities and conserves flow at every interior node', () => {
    for (const e of CLRS) expect(r.flows[`${e.u}->${e.v}`]).toBeLessThanOrEqual(e.cap);
    for (const n of ['v1', 'v2', 'v3', 'v4']) {
      const into = CLRS.filter((e) => e.v === n).reduce((a, e) => a + r.flows[`${e.u}->${e.v}`], 0);
      const outOf = CLRS.filter((e) => e.u === n).reduce((a, e) => a + r.flows[`${e.u}->${e.v}`], 0);
      expect(into, `conservation at ${n}`).toBe(outOf);
    }
  });

  it('total flow leaving the source equals the max flow', () => {
    const outS = CLRS.filter((e) => e.u === 's').reduce((a, e) => a + r.flows[`${e.u}->${e.v}`], 0);
    expect(outS).toBe(23);
  });

  it('augmenting steps accumulate monotonically to the max flow', () => {
    expect(r.steps.length).toBeGreaterThan(0);
    let prev = 0;
    for (const s of r.steps) { expect(s.bottleneck).toBeGreaterThan(0); expect(s.totalAfter).toBeGreaterThan(prev); prev = s.totalAfter; }
    expect(r.steps[r.steps.length - 1].totalAfter).toBe(23);
  });
});

describe('a trivial series bottleneck', () => {
  it('two pipes in series are limited by the smaller', () => {
    const r = maxflow([{ u: 's', v: 'a', cap: 3 }, { u: 'a', v: 't', cap: 5 }], 's', 't');
    expect(r.maxFlow).toBe(3);
    expect(r.cutEdges.reduce((a, e) => a + e.cap, 0)).toBe(3);
  });
  it('parallel pipes add up', () => {
    const r = maxflow([{ u: 's', v: 't', cap: 3 }, { u: 's', v: 'a', cap: 2 }, { u: 'a', v: 't', cap: 2 }], 's', 't');
    expect(r.maxFlow).toBe(5);
  });
});
