import { describe, it, expect } from 'vitest';
import { lis, lisLengthDP } from '../src/web/lis';

const isValidLis = (a: number[], r: ReturnType<typeof lis>) =>
  r.sequence.length === r.length &&
  r.indices.every((idx, i) => (i === 0 || r.indices[i - 1] < idx) && a[idx] === r.sequence[i]) &&           // subsequence
  r.sequence.every((v, i) => i === 0 || r.sequence[i - 1] < v);                                              // strictly increasing

describe('LIS length and reconstruction', () => {
  it('matches a worked example', () => {
    const a = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
    const r = lis(a);
    expect(r.length).toBe(4);
    expect(isValidLis(a, r)).toBe(true);
  });
  it('handles empty, single, all-increasing, all-decreasing, and duplicates', () => {
    expect(lis([]).length).toBe(0);
    expect(lis([7]).sequence).toEqual([7]);
    expect(lis([1, 2, 3, 4, 5]).length).toBe(5);
    expect(lis([5, 4, 3, 2, 1]).length).toBe(1);
    expect(lis([2, 2, 2]).length).toBe(1);                 // strictly increasing → equal values don't extend
  });
  it('the number of piles equals the LIS length', () => {
    const a = [3, 1, 4, 1, 5, 9, 2, 6];
    const r = lis(a);
    expect(Math.max(...r.pile) + 1).toBe(r.length);
  });
});

describe('agrees with the O(n²) DP over random arrays (fuzz)', () => {
  it('20000 arrays: patience-sort length == DP length, and every reconstruction is valid', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let run = 0; run < 20000; run++) {
      const n = rnd(25);
      const a = Array.from({ length: n }, () => rnd(15)); // duplicates likely
      const r = lis(a);
      expect(r.length).toBe(lisLengthDP(a));
      expect(isValidLis(a, r)).toBe(true);
    }
  });
});
