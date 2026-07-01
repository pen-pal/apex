import { describe, it, expect } from 'vitest';
import { build, query, brute } from '../src/web/sparsetable';

describe('range-minimum queries', () => {
  const a = [5, 2, 8, 1, 9, 3, 7, 4];
  const t = build(a);
  it('answers correctly for known ranges', () => {
    expect(query(t, 1, 5).value).toBe(1);
    expect(query(t, 0, 7).value).toBe(1);
    expect(query(t, 5, 7).value).toBe(3);
    expect(query(t, 0, 1).value).toBe(2);
  });
  it('a single-element range returns that element', () => {
    expect(query(t, 3, 3).value).toBe(1);
    expect(query(t, 6, 6).value).toBe(7);
  });
});

describe('the table structure', () => {
  it('level k holds mins of length-2^k blocks, built from the level below', () => {
    const a = [5, 2, 8, 1];
    const t = build(a);
    expect(t[0]).toEqual([5, 2, 8, 1]);         // length-1 blocks = the array
    expect(t[1]).toEqual([2, 2, 1]);            // length-2: min(5,2),min(2,8),min(8,1)
    expect(t[2]).toEqual([1]);                  // length-4: min of the whole thing
  });
  it('the two query blocks are length 2^k and together cover [l, r] (overlap is fine for min)', () => {
    const t = build([5, 2, 8, 1, 9, 3, 7, 4]);
    const { k, blocks } = query(t, 2, 6);
    const [lo, hi] = blocks;
    expect(lo).toBe(2);                          // first block starts at l
    expect(hi + (1 << k) - 1).toBe(6);           // second block ends at r
    expect(hi).toBeLessThanOrEqual(lo + (1 << k)); // they overlap or abut, no gap
  });
});

describe('agrees with brute force everywhere (fuzz)', () => {
  it('5000 random arrays × 8 queries', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let run = 0; run < 5000; run++) {
      const n = 1 + rnd(40);
      const a = Array.from({ length: n }, () => rnd(1000) - 500);
      const t = build(a);
      for (let q = 0; q < 8; q++) {
        const l = rnd(n); const r = l + rnd(n - l);
        expect(query(t, l, r).value).toBe(brute(a, l, r));
      }
    }
  });
});
