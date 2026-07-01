import { describe, it, expect } from 'vitest';
import { sort, threeWayPartition } from '../src/web/dnf';

describe('the flag sort', () => {
  it('groups 0s, 1s, 2s in order in one pass', () => {
    const r = sort([2, 0, 2, 1, 1, 0, 2, 1, 0]);
    expect(r.result).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    expect(r.steps).toHaveLength(9);      // one step per element — a single pass
  });
  it('handles all-same, sorted, and reverse inputs', () => {
    expect(sort([1, 1, 1]).result).toEqual([1, 1, 1]);
    expect(sort([0, 1, 2]).result).toEqual([0, 1, 2]);
    expect(sort([2, 2, 1, 0, 0]).result).toEqual([0, 0, 1, 2, 2]);
    expect(sort([]).result).toEqual([]);
  });
});

describe('flag sort — fuzz', () => {
  it('20k random arrays: sorted, a permutation of the input, and exactly n steps', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 20000; t++) {
      const n = rnd(30);
      const a = Array.from({ length: n }, () => rnd(3));
      const { result, steps } = sort(a);
      expect(result.every((v, i) => i === 0 || result[i - 1] <= v)).toBe(true);           // sorted
      expect([...result].sort()).toEqual([...a].sort());                                   // permutation
      expect(steps.length).toBe(n);                                                        // single pass
    }
  });
});

describe('3-way partition (the quicksort step)', () => {
  it('splits into (<pivot)(==pivot)(>pivot)', () => {
    const { arr, lt, gt } = threeWayPartition([5, 3, 8, 3, 1, 3, 9, 3, 2], 3);
    expect(arr.slice(0, lt).every((x) => x < 3)).toBe(true);
    expect(arr.slice(lt, gt).every((x) => x === 3)).toBe(true);
    expect(arr.slice(gt).every((x) => x > 3)).toBe(true);
    expect(arr.slice(lt, gt)).toHaveLength(4);   // four 3s in the middle
  });
  it('20k random arrays hold the invariant and are permutations', () => {
    let s = 3; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 20000; t++) {
      const n = rnd(30);
      const a = Array.from({ length: n }, () => rnd(10));
      const pivot = rnd(10);
      const { arr, lt, gt } = threeWayPartition(a, pivot);
      expect(arr.slice(0, lt).every((x) => x < pivot)).toBe(true);
      expect(arr.slice(lt, gt).every((x) => x === pivot)).toBe(true);
      expect(arr.slice(gt).every((x) => x > pivot)).toBe(true);
      expect([...arr].sort((x, y) => x - y)).toEqual([...a].sort((x, y) => x - y));
    }
  });
});
