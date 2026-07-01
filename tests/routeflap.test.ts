import { describe, it, expect } from 'vitest';
import { simulate, flapEvery, DEFAULTS } from '../src/web/routeflap';

const anySuppressed = (r: ReturnType<typeof simulate>) => r.series.some((p) => p.suppressed);
const peak = (r: ReturnType<typeof simulate>) => Math.max(...r.series.map((p) => p.penalty));

describe('penalty accumulation and decay', () => {
  it('a stable route accrues no penalty and is never suppressed', () => {
    const r = simulate([], 3600, 30);
    expect(peak(r)).toBe(0);
    expect(anySuppressed(r)).toBe(false);
  });
  it('a single flap adds the penalty but stays below the suppress threshold', () => {
    const r = simulate([60], 3600, 30);
    expect(peak(r)).toBeCloseTo(DEFAULTS.penaltyPerFlap, 0); // ~1000 < 2000
    expect(anySuppressed(r)).toBe(false);
  });
  it('the penalty decays with a 15-minute half-life', () => {
    const r = simulate([0], 1800, 30);
    const at0 = r.series.find((p) => p.t === 0)!.penalty;       // = 1000 (flap at t=0)
    const at900 = r.series.find((p) => p.t === 900)!.penalty;   // one half-life later
    expect(at900).toBeCloseTo(at0 / 2, 0);
  });
});

describe('suppression with hysteresis', () => {
  it('a chronically flapping route gets suppressed, then restored after it stabilizes', () => {
    const r = simulate(flapEvery(60, 300), 3600, 30);
    expect(anySuppressed(r)).toBe(true);
    expect(peak(r)).toBeGreaterThan(DEFAULTS.suppress);
    expect(r.suppressedFor).toBeGreaterThan(0);
    expect(r.series[r.series.length - 1].suppressed).toBe(false); // recovered by the end
  });
  it('while suppressed, the penalty never dropped below the reuse threshold (hysteresis gap)', () => {
    const r = simulate(flapEvery(60, 300), 3600, 30);
    const whileSuppressed = r.series.filter((p) => p.suppressed).map((p) => p.penalty);
    expect(Math.min(...whileSuppressed)).toBeGreaterThanOrEqual(DEFAULTS.reuse); // only reuse below 750
  });
  it('two flaps a minute apart stay under the threshold; three close flaps cross it', () => {
    expect(anySuppressed(simulate([0, 60], 600, 30))).toBe(false);        // peak ~1955 < 2000
    expect(anySuppressed(simulate([0, 30, 60], 600, 30))).toBe(true);     // peak ~2932 > 2000
  });
});

describe('flapEvery helper', () => {
  it('generates evenly spaced flap times', () => {
    expect(flapEvery(60, 300)).toEqual([60, 120, 180, 240, 300]);
  });
});
