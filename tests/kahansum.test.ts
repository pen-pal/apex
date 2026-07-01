import { describe, it, expect } from 'vitest';
import { naiveSum, kahanSum } from '../src/web/kahansum';

describe('naive summation loses low-order bits; Kahan recovers them', () => {
  it('summing ten 0.1s: naive drifts, Kahan lands exactly on 1', () => {
    const tenths = Array(10).fill(0.1);
    expect(naiveSum(tenths)).toBe(0.9999999999999999); // the classic drift
    expect(kahanSum(tenths).sum).toBe(1);              // correctly rounded
  });

  it('a large base plus many sub-ULP additions: naive keeps ALL of them, Kahan keeps NONE lost', () => {
    const EPS = Math.pow(2, -53); // exactly half a ULP at 1.0 → each addition rounds away under naive
    for (const M of [2, 100, 1000, 100000]) {
      const nums = [1, ...Array(M).fill(EPS)];
      const trueSum = 1 + M * EPS;
      expect(naiveSum(nums)).toBe(1);              // every tiny value vanished
      expect(kahanSum(nums).sum).toBe(trueSum);    // Kahan recovered them exactly
      expect(Math.abs(kahanSum(nums).sum - trueSum)).toBeLessThan(Math.abs(naiveSum(nums) - trueSum));
    }
  });

  it('carries a non-zero compensation exactly when bits are being lost', () => {
    expect(kahanSum(Array(10).fill(0.1)).compensation).not.toBe(0);
    expect(kahanSum([1, 2, 3]).compensation).toBe(0); // exact sum, nothing lost
  });
});

describe('for well-conditioned sums, Kahan is never worse than naive (fuzz)', () => {
  it('30000 random all-positive sums vs a high-accuracy pairwise reference', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s / 0x80000000) * n; };
    const pairwise = (a: number[]): number => a.length <= 1 ? (a[0] ?? 0) : pairwise(a.slice(0, a.length >> 1)) + pairwise(a.slice(a.length >> 1));
    for (let t = 0; t < 30000; t++) {
      const N = 2 + Math.floor(rnd(200));
      const nums: number[] = []; for (let i = 0; i < N; i++) nums.push(rnd(1000));
      const ref = pairwise(nums.slice().sort((a, b) => a - b)); // sorted pairwise ≈ the true sum
      const naiveErr = Math.abs(naiveSum(nums) - ref);
      const kahanErr = Math.abs(kahanSum(nums).sum - ref);
      expect(kahanErr).toBeLessThanOrEqual(naiveErr);
    }
  });
});
