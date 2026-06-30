import { describe, it, expect } from 'vitest';
import { budget, burnRate, timeToExhaust, burnAlerts, releasePolicy } from '../src/web/slo';

describe('error budget arithmetic', () => {
  it('99.9% over 1,000,000 requests allows 1,000 failures', () => {
    const b = budget(0.999, 1_000_000, 0);
    expect(b.allowed).toBe(1000);
    expect(b.remaining).toBe(1000);
    expect(b.remainingPct).toBe(100);
    expect(b.exhausted).toBe(false);
  });
  it('600 failures spends 60% of the budget', () => {
    const b = budget(0.999, 1_000_000, 600);
    expect(b.remaining).toBe(400);
    expect(b.remainingPct).toBeCloseTo(40, 6);
    expect(b.exhausted).toBe(false);
  });
  it('hitting the allowance exhausts the budget and freezes releases', () => {
    const b = budget(0.999, 1_000_000, 1000);
    expect(b.exhausted).toBe(true);
    expect(b.remainingPct).toBe(0);
    expect(releasePolicy(b)).toMatch(/FREEZE/);
  });
  it('an available budget allows shipping', () => {
    expect(releasePolicy(budget(0.999, 1_000_000, 10))).toMatch(/ship/i);
  });
});

describe('burn rate', () => {
  it('an error rate equal to the budget burns at exactly 1×', () => {
    expect(burnRate(0.001, 0.999)).toBeCloseTo(1, 9); // 0.1% errors against a 0.1% budget
  });
  it('a 1% error rate against a 99.9% SLO burns at 10×', () => {
    expect(burnRate(0.01, 0.999)).toBeCloseTo(10, 6);
  });
  it('time-to-exhaust shrinks as the burn rate rises', () => {
    const b = budget(0.999, 1_000_000, 0);
    const slow = timeToExhaust(b, 1, 43200);   // 1× over the 30-day window → ~the whole window
    const fast = timeToExhaust(b, 10, 43200);  // 10× → a tenth of it
    expect(slow).toBeCloseTo(43200, 0);
    expect(fast).toBeCloseTo(4320, 0);
    expect(fast).toBeLessThan(slow);
  });
});

describe('multiwindow burn-rate alerts', () => {
  it('a huge burn fires the fast-burn page', () => {
    const a = burnAlerts(15);
    expect(a.find((x) => x.label === 'fast burn')!.firing).toBe(true);
    expect(a.find((x) => x.label === 'fast burn')!.severity).toBe('page');
  });
  it('a small steady burn fires only the slow-burn ticket, not a page', () => {
    const a = burnAlerts(2);
    expect(a.find((x) => x.label === 'slow burn')!.firing).toBe(true);
    expect(a.find((x) => x.label === 'fast burn')!.firing).toBe(false);
    expect(a.find((x) => x.label === 'medium burn')!.firing).toBe(false);
  });
  it('burning at exactly budget (1×) trips the slow-burn watch but nothing acute', () => {
    const a = burnAlerts(1);
    expect(a.filter((x) => x.firing).map((x) => x.label)).toEqual(['slow burn']);
  });
});
