import { describe, it, expect } from 'vitest';
import { throughput, peakConcurrency, amdahlCeiling, curve } from '../src/web/usl';

describe('the formula anchors', () => {
  it('C(1) = 1 for any coefficients (speedup is relative to one worker)', () => {
    expect(throughput(1, 0.03, 0.0003)).toBe(1);
    expect(throughput(1, 0.2, 0.05)).toBe(1);
    expect(throughput(1, 0, 0)).toBe(1);
  });
  it('perfect linear scaling when there is no contention or coherency cost', () => {
    expect(throughput(10, 0, 0)).toBe(10);
    expect(throughput(100, 0, 0)).toBe(100);
  });
});

describe('β = 0 recovers Amdahl’s law', () => {
  it('throughput rises monotonically toward the ceiling 1/α', () => {
    const a = 0.05;
    for (let n = 1; n < 50; n++) expect(throughput(n + 1, a, 0)).toBeGreaterThan(throughput(n, a, 0)); // monotone up
    expect(throughput(100000, a, 0)).toBeCloseTo(amdahlCeiling(a), 1); // → 20
    expect(throughput(100000, a, 0)).toBeLessThan(amdahlCeiling(a));    // never reaches it
  });
});

describe('β > 0 makes scaling go retrograde', () => {
  const a = 0.03, b = 0.0003;
  it('peaks at N* = sqrt((1−α)/β), matching the numerical argmax', () => {
    const star = peakConcurrency(a, b);
    expect(star).toBeCloseTo(Math.sqrt((1 - a) / b), 6);
    let best = 1, bestC = 0;
    for (let n = 1; n <= 500; n++) { const c = throughput(n, a, b); if (c > bestC) { bestC = c; best = n; } }
    expect(Math.abs(best - Math.round(star))).toBeLessThanOrEqual(1);
    // the peak really is a local maximum
    expect(throughput(best, a, b)).toBeGreaterThanOrEqual(throughput(best - 1, a, b));
    expect(throughput(best, a, b)).toBeGreaterThanOrEqual(throughput(best + 1, a, b));
  });
  it('adding workers past the peak reduces throughput', () => {
    const star = Math.round(peakConcurrency(a, b));
    expect(throughput(star * 2, a, b)).toBeLessThan(throughput(star, a, b));
    expect(throughput(star * 4, a, b)).toBeLessThan(throughput(star * 2, a, b));
  });
  it('peakConcurrency is Infinity when β = 0 (no retrograde region)', () => {
    expect(peakConcurrency(0.05, 0)).toBe(Infinity);
  });
});

describe('curve', () => {
  it('samples N = 1..maxN with C(1)=1', () => {
    const c = curve(0.03, 0.0003, 200);
    expect(c).toHaveLength(200);
    expect(c[0]).toEqual({ n: 1, c: 1 });
    expect(c[199].n).toBe(200);
  });
});
