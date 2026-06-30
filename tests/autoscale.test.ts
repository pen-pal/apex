import { describe, it, expect } from 'vitest';
import { desiredReplicas, simulate, type HpaOpts } from '../src/web/autoscale';

const OPTS: HpaOpts = { target: 50, min: 1, max: 10, tolerance: 0.1 };

describe('the HPA formula: ceil(current × metric / target)', () => {
  it('reproduces the Kubernetes doc example (3 replicas @100, target 50 → 6)', () => {
    expect(desiredReplicas(3, 100, OPTS)).toBe(6);
  });
  it('scales down when under-utilized (4 replicas @25, target 50 → 2)', () => {
    expect(desiredReplicas(4, 25, OPTS)).toBe(2); // ceil(4 × 25/50)
  });
  it('holds inside the ±10% tolerance band (avoids thrashing)', () => {
    expect(desiredReplicas(4, 52, OPTS)).toBe(4); // ratio 1.04 → no change
    expect(desiredReplicas(4, 47, OPTS)).toBe(4); // ratio 0.94 → no change
  });
  it('clamps to [min, max]', () => {
    expect(desiredReplicas(8, 100, OPTS)).toBe(10);  // ceil(16) clamped to max
    expect(desiredReplicas(2, 1, OPTS)).toBe(1);     // clamped to min
  });
});

describe('simulation tracks load over time', () => {
  it('scales up immediately as load rises', () => {
    const sim = simulate([100, 200, 400], 2, OPTS, 1); // target 50/replica
    // t0: 100/2=50 → ratio1 → hold (2). t1: 200/2=100 → ceil(2×2)=4. t2: 400/4=100 → ceil(4×2)=8.
    expect(sim.map((s) => s.replicas)).toEqual([2, 2, 4]);
    expect(sim[sim.length - 1].desired).toBe(8);
    expect(sim[1].action).toBe('scale up');
  });

  it('a scale-down stabilization window rides out a brief dip', () => {
    // load drops for one tick then recovers; with downDelay 2 it should NOT scale down on the blip
    const sim = simulate([400, 50, 400], 8, { ...OPTS }, 2);
    const downs = sim.filter((s) => s.action === 'scale down');
    expect(downs).toHaveLength(0); // the single low tick didn't survive the 2-tick window
  });

  it('sustained low load does scale down (after the window)', () => {
    const sim = simulate([50, 50, 50, 50], 8, { ...OPTS }, 2);
    expect(sim.some((s) => s.action === 'scale down')).toBe(true);
    expect(sim[sim.length - 1].replicas).toBeLessThan(8);
  });

  it('never exceeds max or drops below min', () => {
    const sim = simulate([9999, 9999, 0, 0, 0], 1, OPTS, 1);
    for (const s of sim) { expect(s.replicas).toBeGreaterThanOrEqual(1); expect(s.replicas).toBeLessThanOrEqual(10); }
  });
});
