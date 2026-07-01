import { describe, it, expect } from 'vitest';
import { kadane, brute } from '../src/web/kadane';

describe('finds the maximum-sum contiguous subarray', () => {
  it('the classic example', () => {
    const a = [-2, 1, -3, 4, -1, 2, 1, -5, 4];
    const r = kadane(a);
    expect(r.maxSum).toBe(6);
    expect(a.slice(r.start, r.end + 1)).toEqual([4, -1, 2, 1]);
  });
  it('all negative → the single largest element (never the empty subarray)', () => {
    const r = kadane([-5, -2, -8, -1, -9]);
    expect(r.maxSum).toBe(-1);
    expect(r.start).toBe(3);
    expect(r.end).toBe(3);
  });
  it('all positive → the whole array', () => {
    const r = kadane([1, 2, 3, 4]);
    expect(r.maxSum).toBe(10);
    expect([r.start, r.end]).toEqual([0, 3]);
  });
  it('a single element', () => {
    expect(kadane([7]).maxSum).toBe(7);
    expect(kadane([-7]).maxSum).toBe(-7);
  });
});

describe('the running-total resets when a fresh start beats extending', () => {
  it('marks a reset exactly when the prior prefix is worse than starting over', () => {
    const r = kadane([-2, 1, -3, 4]);
    // extending -2 into 1: -2+1=-1 < 1 → reset at i=1; 1 into -3: 1-3=-2 > -3 → no reset; -2 into 4: -2+4=2 < 4 → reset at i=3
    expect(r.steps.map((s) => s.reset)).toEqual([false, true, false, true]);
    expect(r.maxSum).toBe(4);
  });
});

describe('agrees with the O(n²) brute force everywhere', () => {
  it('10k random arrays, and the returned subarray really sums to maxSum', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 10000; t++) {
      const n = 1 + rnd(15);
      const a = Array.from({ length: n }, () => rnd(21) - 10);
      const k = kadane(a);
      expect(k.maxSum).toBe(brute(a));
      expect(a.slice(k.start, k.end + 1).reduce((x, y) => x + y, 0)).toBe(k.maxSum);
    }
  });
});
