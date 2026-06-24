import { describe, it, expect } from 'vitest';
import { build, queryMin, update, naiveMin } from '../src/web/segtree';

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
    const r = queryMin(s, 1, 6);
    expect(r.nodes.length).toBeLessThanOrEqual(2 * Math.log2(s.n)); // ≤ 2·log n
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
