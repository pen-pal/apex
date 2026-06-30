import { describe, it, expect } from 'vitest';
import { newton, sqrtNewton } from '../src/web/newton';

describe('Babylonian square root', () => {
  it('reproduces the hand-computed first iterates of √2 from x0=1', () => {
    const s = sqrtNewton(2, 1, 3);
    expect(s[0].next).toBeCloseTo(1.5, 10);          // 1 − (−1)/2
    expect(s[1].next).toBeCloseTo(1.4166666667, 9);  // 1.5 − 0.25/3
    expect(s[2].next).toBeCloseTo(1.4142156863, 9);
  });
  it('converges to √2 within a few iterations', () => {
    const s = sqrtNewton(2, 1, 6);
    expect(s[s.length - 1].next).toBeCloseTo(Math.SQRT2, 12);
  });
  it('works from a poor initial guess too', () => {
    const s = sqrtNewton(100, 1, 12);
    expect(s[s.length - 1].next).toBeCloseTo(10, 10);
  });
});

describe('quadratic convergence — the error squares each step', () => {
  it('error_{n+1} is on the order of error_n² (digits double)', () => {
    const s = sqrtNewton(2, 1.5, 5); // start close so we are in the quadratic regime
    for (let i = 1; i < 4; i++) {
      const prev = s[i].error, next = s[i + 1].error;
      if (prev > 1e-12) expect(next).toBeLessThanOrEqual(prev * prev * 2 + 1e-15); // ~C·error²
    }
  });
});

describe('general roots', () => {
  it('finds the real root of x³ − x − 2 ≈ 1.5214', () => {
    const s = newton((x) => x ** 3 - x - 2, (x) => 3 * x * x - 1, 2, 8, 1.5213797068045676);
    expect(s[s.length - 1].next).toBeCloseTo(1.5213797068, 9);
  });
  it('a zero derivative is handled without dividing by zero (the iterate holds)', () => {
    const s = newton((x) => x * x, (x) => 2 * x, 0, 1); // f(0)=0, f\'(0)=0
    expect(Number.isFinite(s[0].next)).toBe(true);
    expect(s[0].next).toBe(0);
  });
});
