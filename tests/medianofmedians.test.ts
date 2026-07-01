import { describe, it, expect } from 'vitest';
import { select, analyze } from '../src/web/medianofmedians';

describe('selection is correct', () => {
  it('returns the k-th smallest for every k', () => {
    const a = [9, 3, 7, 1, 8, 2, 6, 5, 4, 0];
    for (let k = 0; k < a.length; k++) expect(select(a, k)).toBe([...a].sort((x, y) => x - y)[k]);
  });
  it('single element, and does not mutate the input', () => {
    expect(select([42], 0)).toBe(42);
    const a = [3, 1, 2]; select(a, 0); expect(a).toEqual([3, 1, 2]);
  });
  it('20k random arrays (with duplicates) match sorted[k]', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 20000; t++) {
      const n = 1 + rnd(60);
      const arr = Array.from({ length: n }, () => rnd(20)); // duplicates likely
      const k = rnd(n);
      expect(select(arr, k)).toBe([...arr].sort((x, y) => x - y)[k]);
    }
  });
});

describe('the median-of-medians pivot is never lopsided', () => {
  it('the pivot avoids the extreme tails, so partitions are balanced', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    let worst = 1;
    for (let t = 0; t < 4000; t++) {
      const n = 15 + rnd(85);
      const set = new Set<number>(); while (set.size < n) set.add(rnd(1000));
      const an = analyze([...set]);
      const frac = an.less / an.n;
      worst = Math.min(worst, Math.min(frac, 1 - frac));
    }
    expect(worst).toBeGreaterThan(0.15); // bounded away from the tails (→ ~0.3 as n grows)
  });
  it('analyze exposes the groups, their medians, and the balance', () => {
    const an = analyze([9, 3, 7, 1, 8, 2, 6, 5, 4, 0, 15, 11, 13, 12, 14, 20, 18, 17, 19, 16]);
    expect(an.groups).toHaveLength(4);              // 20 elements → 4 groups of 5
    expect(an.medians).toEqual([7, 4, 13, 18]);
    expect(an.pivot).toBe(13);                       // median of [7,4,13,18]
    expect(an.less + an.greater + an.equal).toBe(20);
  });
});
