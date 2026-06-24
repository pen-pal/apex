import { describe, it, expect } from 'vitest';
import { build, queryMin, update, naiveMin, buildLazy, rangeAdd, queryLazy, toArray } from '../src/web/segtree';

const A = [5, 2, 8, 1, 9, 3, 7, 4];

describe('range-minimum queries', () => {
  const s = build(A);
  it('hand-worked ranges', () => {
    expect(queryMin(s, 2, 5).min).toBe(1); // min(8,1,9,3)
    expect(queryMin(s, 0, 2).min).toBe(2); // min(5,2,8)
    expect(queryMin(s, 4, 7).min).toBe(3); // min(9,3,7,4)
    expect(queryMin(s, 3, 3).min).toBe(1); // single element
    expect(queryMin(s, 0, 7).min).toBe(1); // whole array
  });

  it('agrees with brute force on every range', () => {
    for (let l = 0; l < A.length; l++)
      for (let r = l; r < A.length; r++)
        expect(queryMin(s, l, r).min).toBe(naiveMin(A, l, r));
  });

  it('a query touches only O(log n) nodes', () => {
    // tight bound so a regression to a linear O(r-l) scan would actually fail
    for (let l = 0; l < A.length; l++) for (let r = l; r < A.length; r++)
      expect(queryMin(s, l, r).nodes.length).toBeLessThanOrEqual(Math.ceil(Math.log2(s.n)) + 1);
  });
});

describe('point updates', () => {
  it('an update changes the affected range minima', () => {
    const s = build(A);
    update(s, 3, 6);                       // A[3]: 1 → 6
    expect(queryMin(s, 2, 5).min).toBe(3); // now min(8,6,9,3)
    expect(queryMin(s, 0, 7).min).toBe(2); // the global min is now 2 (the 1 is gone)
  });

  it('the update path runs from the leaf to the root', () => {
    const s = build(A);
    const path = update(s, 0, 0);
    expect(path[0]).toBe(s.n);                 // the leaf for index 0
    expect(path[path.length - 1]).toBe(1);     // the root
  });

  it('repeated updates and queries stay consistent with brute force', () => {
    const arr = [...A];
    const s = build(arr);
    for (const [i, v] of [[1, 0], [6, -3], [3, 10], [0, 5]] as [number, number][]) {
      arr[i] = v; update(s, i, v);
      for (let l = 0; l < arr.length; l++) for (let r = l; r < arr.length; r++)
        expect(queryMin(s, l, r).min).toBe(naiveMin(arr, l, r));
    }
  });
});

describe('lazy propagation — range add + range min vs brute force', () => {
  it('matches a brute-force array after a sequence of range-adds', () => {
    const arr = [...A];
    const t = buildLazy(arr);
    const ops: [number, number, number][] = [[1, 4, +3], [0, 7, -2], [2, 2, +10], [5, 7, +1], [0, 3, -5]];
    for (const [l, r, d] of ops) {
      for (let i = l; i <= r; i++) arr[i] += d; // brute-force apply
      rangeAdd(t, l, r, d);
      expect(toArray(t)).toEqual(arr); // every element matches
      for (let l2 = 0; l2 < arr.length; l2++) for (let r2 = l2; r2 < arr.length; r2++)
        expect(queryLazy(t, l2, r2)).toBe(naiveMin(arr, l2, r2)); // every range min matches
    }
  });

  it('a range-add tags only O(log n) nodes, never every covered leaf', () => {
    const t = buildLazy([0, 0, 0, 0, 0, 0, 0, 0]); // n=8
    const tagged = rangeAdd(t, 0, 7, 5); // the whole array
    expect(tagged).toEqual([1]); // a single fully-covering node (the root) absorbs it — not 8 leaves
    expect(queryLazy(t, 3, 3)).toBe(5); // yet every element reads as updated once pushed down
    const tagged2 = rangeAdd(t, 1, 6, 2); // a straddling range
    expect(tagged2.length).toBeLessThanOrEqual(4); // O(log n) frontier, far fewer than 6 elements
  });

  it('handles a degenerate single-element tree', () => {
    const t = buildLazy([42]);
    rangeAdd(t, 0, 0, 8);
    expect(queryLazy(t, 0, 0)).toBe(50);
    expect(toArray(t)).toEqual([50]);
  });
});
