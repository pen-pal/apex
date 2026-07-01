import { describe, it, expect } from 'vitest';
import { simulate, burstCapacity, sustainedRatePerSec } from '../src/web/gcra';

const flags = (d: ReturnType<typeof simulate>) => d.map((x) => (x.allow ? 'Y' : 'N')).join('');

describe('burst and steady-state behavior', () => {
  it('an idle client may burst ⌊τ/T⌋+1 requests, then is throttled', () => {
    expect(burstCapacity(1, 3)).toBe(4);
    expect(flags(simulate([0, 0, 0, 0, 0, 0], 1, 3))).toBe('YYYYNN');
    expect(burstCapacity(2, 4)).toBe(3);
    expect(flags(simulate([0, 0, 0, 0], 2, 4))).toBe('YYYN');
  });
  it('requests paced at exactly T are all allowed', () => {
    expect(simulate([0, 1, 2, 3, 4, 5, 6, 7], 1, 3).every((d) => d.allow)).toBe(true);
  });
  it('over a long fast stream the allowed count is ≈ burst + elapsed/T (sustained ≈ 1/T)', () => {
    const times = Array.from({ length: 1000 }, (_, i) => i * 0.1); // 10 req/s for ~100 s
    const allowed = simulate(times, 1, 3).filter((d) => d.allow).length;
    expect(allowed).toBeGreaterThanOrEqual(100);   // ~ burst(4) + ~99 sustained
    expect(allowed).toBeLessThanOrEqual(105);
    expect(sustainedRatePerSec(1)).toBe(1);
  });
});

describe('the TAT and Retry-After', () => {
  it('TAT is monotonic and a rejected request never advances it', () => {
    const d = simulate([0, 0, 0, 0, 0, 0], 1, 3);
    for (let i = 1; i < d.length; i++) expect(d[i].tat).toBeGreaterThanOrEqual(d[i - 1].tat);
    expect(d[4].tat).toBe(d[3].tat);               // 5th (rejected) leaves TAT where the 4th put it
    expect(d[5].tat).toBe(d[3].tat);
  });
  it('retry-after is exact: retrying at t + retryAfter is accepted', () => {
    const d = simulate([0, 0, 0, 0, 0], 1, 3);     // 5th is rejected
    const rej = d[4];
    expect(rej.allow).toBe(false);
    const retried = simulate([0, 0, 0, 0, rej.t + rej.retryAfter], 1, 3);
    expect(retried[4].allow).toBe(true);
  });
  it('idle time banks burst capacity back', () => {
    const d = simulate([0, 100, 100, 100, 100, 100], 1, 3); // one request, long idle, then a burst
    expect(flags(d)).toBe('YYYYYN');               // the burst refilled to capacity during the idle gap
  });
});
