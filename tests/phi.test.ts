import { describe, it, expect } from 'vitest';
import { erf, normalCdf, phi, phiAt, stats } from '../src/web/phi';

describe('normal-distribution machinery', () => {
  it('erf matches known values', () => {
    expect(erf(0)).toBeCloseTo(0, 6);
    expect(erf(1)).toBeCloseTo(0.8427, 3);
    expect(erf(-1)).toBeCloseTo(-0.8427, 3);
  });
  it('normal CDF hits the standard 68-95-99.7 marks', () => {
    expect(normalCdf(0, 0, 1)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1, 0, 1)).toBeCloseTo(0.8413, 3); // +1σ
    expect(normalCdf(2, 0, 1)).toBeCloseTo(0.9772, 3); // +2σ
  });
});

describe('phi suspicion level (the paper’s formula)', () => {
  const mu = 100, sigma = 10;
  it('is ~0.301 when the silence equals the mean interval (P_later = 0.5)', () => {
    expect(phi(mu, mu, sigma)).toBeCloseTo(0.30103, 3); // -log10(0.5)
  });
  it('climbs through the σ marks exactly as the normal tail dictates', () => {
    expect(phi(mu + sigma, mu, sigma)).toBeCloseTo(0.799, 2); // -log10(1-0.8413)
    expect(phi(mu + 2 * sigma, mu, sigma)).toBeCloseTo(1.643, 2); // -log10(1-0.9772)
    expect(phi(mu + 3 * sigma, mu, sigma)).toBeCloseTo(2.87, 1); // -log10(1-0.99865)
  });
  it('rises monotonically the longer we wait (until the tail saturates the clamp)', () => {
    let prev = -Infinity;
    for (let gap = 80; gap <= 160; gap += 10) { const p = phi(gap, mu, sigma); expect(p).toBeGreaterThan(prev); prev = p; }
    expect(phi(300, mu, sigma)).toBe(12); // far out, P_later underflows → phi clamps at 12 (1-in-10^12)
  });
  it('ADAPTS to variance: a jittery link yields a lower phi for the same silence', () => {
    const gap = 150;
    const calm = phi(gap, 100, 10); // tight distribution → 150 is very unlikely
    const jittery = phi(gap, 100, 40); // wide distribution → 150 is unremarkable
    expect(jittery).toBeLessThan(calm); // the detector tolerates jitter instead of false-alarming
  });
});

describe('phiAt over a heartbeat stream', () => {
  const arrivals = Array.from({ length: 20 }, (_, i) => i * 100); // steady 100ms beats: 0,100,…,1900
  it('is low right after a heartbeat and grows during silence', () => {
    expect(phiAt(arrivals, 1900)).toBeCloseTo(0, 5); // just arrived → no suspicion
    const a = phiAt(arrivals, 2000); // one interval of silence
    const b = phiAt(arrivals, 2200); // longer silence
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(0);
  });
  it('reaches a high suspicion when a node has clearly gone quiet', () => {
    expect(phiAt(arrivals, 2600)).toBeGreaterThan(8); // ~700ms of silence on a 100ms cadence → very dead
  });
  it('returns 0 before two heartbeats exist to estimate from', () => {
    expect(phiAt([0], 500)).toBe(0);
  });
});

describe('stats', () => {
  it('floors sigma so a perfectly regular stream never divides by zero', () => {
    expect(stats([100, 100, 100], 1).sigma).toBe(1);
    expect(stats([100, 100, 100], 1).mu).toBe(100);
  });
});
