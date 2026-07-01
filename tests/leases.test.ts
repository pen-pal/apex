import { describe, it, expect } from 'vitest';
import { analyze, minSafeGuard } from '../src/web/leases';

describe('the split-brain risk when the holder over-holds', () => {
  it('a slow-clocked holder keeps acting after the granter re-grants → overlap (unsafe)', () => {
    const r = analyze({ duration: 10, clockSkew: 3, netDelay: 1, guardInterval: 0 });
    expect(r.granterExpiry).toBe(10);
    expect(r.holderBelievesUntil).toBe(14); // over-holds by skew + delay
    expect(r.newGrantAt).toBe(10);          // no guard → re-grant right at expiry
    expect(r.overlap).toBe(4);              // 4 units with two "leaders"
    expect(r.safe).toBe(false);
  });
  it('perfect clocks and no delay are always safe, even with no guard', () => {
    expect(analyze({ duration: 10, clockSkew: 0, netDelay: 0, guardInterval: 0 }).safe).toBe(true);
  });
});

describe('the guard interval is what makes leases safe', () => {
  it('a guard ≥ skew + delay closes the window exactly', () => {
    const r = analyze({ duration: 10, clockSkew: 3, netDelay: 1, guardInterval: 4 });
    expect(r.overlap).toBe(0);
    expect(r.safe).toBe(true);
  });
  it('a guard just short of the needed value still overlaps', () => {
    const r = analyze({ duration: 10, clockSkew: 3, netDelay: 1, guardInterval: 3 });
    expect(r.overlap).toBe(1);
    expect(r.safe).toBe(false);
  });
  it('minSafeGuard is exactly skew + delay, and using it is the safety boundary', () => {
    const p = { duration: 20, clockSkew: 5, netDelay: 2 };
    const g = minSafeGuard(p);
    expect(g).toBe(7);
    expect(analyze({ ...p, guardInterval: g }).safe).toBe(true);
    expect(analyze({ ...p, guardInterval: g - 1 }).safe).toBe(false);
  });
});

describe('lease duration does not affect safety — only skew/delay vs guard do', () => {
  it('longer leases with the same skew/guard have the same overlap', () => {
    const a = analyze({ duration: 10, clockSkew: 4, netDelay: 0, guardInterval: 1 });
    const b = analyze({ duration: 1000, clockSkew: 4, netDelay: 0, guardInterval: 1 });
    expect(a.overlap).toBe(b.overlap);
    expect(a.overlap).toBe(3); // 4 - 1
  });
});
