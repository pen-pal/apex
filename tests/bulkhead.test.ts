import { describe, it, expect } from 'vitest';
import { analyze, type Dep } from '../src/web/bulkhead';

const HEALTHY: Dep[] = [
  { name: 'A', rate: 20, latencyMs: 50 }, // demand 1.0
  { name: 'B', rate: 30, latencyMs: 50 }, // demand 1.5
  { name: 'C', rate: 20, latencyMs: 50 }, // demand 1.0
];
const POOL = 12;
const names = (deps: { name: string; healthy: boolean }[]) => deps.filter((d) => d.healthy).map((d) => d.name);

describe('under normal load both designs are fine', () => {
  it('nobody is saturated; everyone healthy', () => {
    const r = analyze(HEALTHY, POOL);
    expect(r.shared.saturated).toBe(false);
    expect(names(r.shared.deps)).toEqual(['A', 'B', 'C']);
    expect(names(r.bulkhead.deps)).toEqual(['A', 'B', 'C']);
  });
});

describe('one slow dependency: shared pool vs bulkhead', () => {
  // C degrades: 20 req/s at 2000ms each → demand 40, far over the pool
  const slow: Dep[] = [HEALTHY[0], HEALTHY[1], { name: 'C', rate: 20, latencyMs: 2000 }];

  it('a SHARED pool saturates and the WHOLE service goes down', () => {
    const r = analyze(slow, POOL);
    expect(r.shared.saturated).toBe(true);
    expect(r.shared.totalDemand).toBeGreaterThan(POOL);
    expect(names(r.shared.deps)).toEqual([]); // A and B are collateral damage
  });

  it('BULKHEADS contain the failure — only C degrades, A and B keep serving', () => {
    const r = analyze(slow, POOL);
    expect(names(r.bulkhead.deps)).toEqual(['A', 'B']); // C isolated out
    const c = r.bulkhead.deps.find((d) => d.name === 'C')!;
    expect(c.healthy).toBe(false);
    expect(c.served).toBe(r.bulkhead.capPerDep); // C can only use its own compartment
    expect(c.served).toBeLessThan(c.demand);
  });

  it('the healthy dependencies are truly unaffected in the bulkhead design', () => {
    const r = analyze(slow, POOL);
    for (const name of ['A', 'B']) {
      const d = r.bulkhead.deps.find((x) => x.name === name)!;
      expect(d.served).toBe(d.demand); // served exactly what they needed
    }
  });
});

describe('the cap is the pool split across dependencies', () => {
  it('capPerDep = poolSize / number of dependencies', () => {
    expect(analyze(HEALTHY, 12).bulkhead.capPerDep).toBe(4);
    expect(analyze(HEALTHY, 9).bulkhead.capPerDep).toBe(3);
  });
  it('a dependency needing more than its cap is unhealthy even if the total would fit', () => {
    // total demand small, but one dep alone exceeds its 1/3 share
    const skew: Dep[] = [{ name: 'A', rate: 100, latencyMs: 50 }, { name: 'B', rate: 1, latencyMs: 50 }, { name: 'C', rate: 1, latencyMs: 50 }];
    const r = analyze(skew, 12); // cap 4; A demand 5 > 4
    expect(r.bulkhead.deps.find((d) => d.name === 'A')!.healthy).toBe(false);
    expect(names(r.bulkhead.deps)).toEqual(['B', 'C']);
    expect(r.shared.saturated).toBe(false); // shared pool would have been fine here — the tradeoff
  });
});
