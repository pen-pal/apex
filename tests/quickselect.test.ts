import { describe, it, expect } from 'vitest';
import { quickselect } from '../src/web/quickselect';

describe('quickselect — k-th smallest matches a full sort', () => {
  it('finds every order statistic', () => {
    const arr = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
    const sorted = [...arr].sort((x, y) => x - y);
    for (let k = 0; k < arr.length; k++) {
      expect(quickselect(arr, k).value).toBe(sorted[k]);
    }
  });
  it('does not mutate the caller\'s array', () => {
    const arr = [5, 2, 8, 1];
    quickselect(arr, 2);
    expect(arr).toEqual([5, 2, 8, 1]);
  });
  it('the median', () => {
    expect(quickselect([7, 1, 3, 9, 5], 2).value).toBe(5); // sorted [1,3,5,7,9], index 2
  });
  it('min and max', () => {
    const a = [4, 2, 7, 1, 9, 3];
    expect(quickselect(a, 0).value).toBe(1);
    expect(quickselect(a, a.length - 1).value).toBe(9);
  });
  it('handles duplicates and a single element', () => {
    expect(quickselect([2, 2, 2, 2], 2).value).toBe(2);
    expect(quickselect([42], 0).value).toBe(42);
  });
  it('rejects out-of-range k', () => {
    expect(() => quickselect([1, 2, 3], 3)).toThrow();
    expect(() => quickselect([1, 2, 3], -1)).toThrow();
  });
});

describe('it is linear, not n log n', () => {
  it('total comparisons stay well under a full sort and the pivot lands at k', () => {
    const arr = Array.from({ length: 256 }, (_, i) => (i * 97 + 13) % 256); // a permutation
    const r = quickselect(arr, 128);
    expect(r.value).toBe(128);          // the true median of 0..255
    expect(r.sortedAt).toBe(128);       // pivot reached index k
    expect(r.comparisons).toBeLessThan(arr.length * Math.log2(arr.length)); // < n log n
  });
  it('each step narrows the search window toward k', () => {
    const r = quickselect([9, 8, 7, 6, 5, 4, 3, 2, 1, 0], 3);
    // every non-final step points toward the side containing k
    for (const s of r.steps) {
      if (s.goesLeft === true) expect(3).toBeLessThan(s.landedAt);
      if (s.goesLeft === false) expect(3).toBeGreaterThan(s.landedAt);
    }
    expect(r.value).toBe(3);
  });
});
