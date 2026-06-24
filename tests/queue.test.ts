import { describe, it, expect } from 'vitest';
import { mm1, latencyFactor } from '../src/web/queue';

describe('M/M/1 closed forms', () => {
  it('at ρ = 0.5 (λ=0.5, μ=1): L=1, Lq=0.5, W=2, Wq=1', () => {
    const q = mm1(0.5, 1);
    expect(q.rho).toBe(0.5);
    expect(q.L).toBeCloseTo(1, 10);
    expect(q.Lq).toBeCloseTo(0.5, 10);
    expect(q.W).toBeCloseTo(2, 10);
    expect(q.Wq).toBeCloseTo(1, 10);
  });

  it("obeys Little's law L = λW", () => {
    for (const [lam, mu] of [[0.3, 1], [0.7, 1], [600, 1000]] as const) {
      const q = mm1(lam, mu);
      expect(q.L).toBeCloseTo(lam * q.W, 6);
      expect(q.Lq).toBeCloseTo(lam * q.Wq, 6);
    }
  });

  it('the wait explodes as load rises', () => {
    expect(mm1(0.5, 1).W).toBe(2); // 2 service times
    expect(mm1(0.9, 1).W).toBeCloseTo(10, 9); // 10
    expect(mm1(0.99, 1).W).toBeCloseTo(100, 6); // 100
  });

  it('ρ ≥ 1 is unstable (unbounded)', () => {
    expect(mm1(1, 1).stable).toBe(false);
    expect(mm1(1.2, 1).L).toBe(Infinity);
  });
});

describe('latencyFactor 1/(1−ρ)', () => {
  it('matches the system time in service-time units', () => {
    expect(latencyFactor(0)).toBe(1);
    expect(latencyFactor(0.75)).toBe(4);
    expect(latencyFactor(0.9)).toBeCloseTo(10, 9);
  });
});
