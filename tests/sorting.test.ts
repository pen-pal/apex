import { describe, it, expect } from 'vitest';
import { ALGOS, bubbleSort, selectionSort, type AlgoName } from '../src/web/sorting';

const sorted = (a: number[]) => [...a].sort((x, y) => x - y);

describe('every algorithm sorts correctly', () => {
  const inputs = [[5, 3, 8, 1, 9, 2, 7], [1, 2, 3, 4, 5], [5, 4, 3, 2, 1], [3, 1, 4, 1, 5, 9, 2, 6], [42], []];
  for (const name of Object.keys(ALGOS) as AlgoName[])
    for (const input of inputs)
      it(`${name} sorts ${JSON.stringify(input)}`, () => {
        expect(ALGOS[name](input).result).toEqual(sorted(input));
      });
});

describe('hand-counted operation totals', () => {
  it('bubble sort on a reversed array does n(n-1)/2 swaps and comparisons', () => {
    const t = bubbleSort([5, 4, 3, 2, 1]); // n=5 → 10
    expect(t.swaps).toBe(10);
    expect(t.comparisons).toBe(10);
  });
  it('bubble sort on an already-sorted array does zero swaps', () => {
    expect(bubbleSort([1, 2, 3, 4, 5]).swaps).toBe(0);
  });
  it('selection sort always does n(n-1)/2 comparisons regardless of input', () => {
    expect(selectionSort([5, 4, 3, 2, 1]).comparisons).toBe(10); // n=5
    expect(selectionSort([1, 2, 3, 4, 5]).comparisons).toBe(10); // same — not adaptive
  });
});

describe('the trace', () => {
  it('every frame of every algorithm is a permutation of the input (nothing created or lost)', () => {
    const inputs = [[5, 4, 3, 2, 1], [3, 1, 4, 1, 5, 9, 2, 6], [9, 7, 5, 3, 1, 8, 6, 4, 2, 0], [2, 2, 2, 1]];
    for (const name of Object.keys(ALGOS) as AlgoName[])
      for (const input of inputs) {
        const want = sorted(input);
        for (const f of ALGOS[name](input).frames)
          expect([...f.array].sort((a, b) => a - b)).toEqual(want); // multiset preserved every frame
      }
  });

  it('records frames and the final result is sorted', () => {
    const t = ALGOS.quick([3, 1, 2]);
    expect(t.frames.length).toBeGreaterThan(0);
    expect(t.result).toEqual([1, 2, 3]);
  });

  it('O(n log n) sorts use far fewer comparisons than O(n²) on larger input', () => {
    const input = Array.from({ length: 32 }, (_, i) => (i * 7 + 3) % 32);
    expect(ALGOS.merge(input).comparisons).toBeLessThan(ALGOS.bubble(input).comparisons);
  });

  it("quicksort's O(n²) worst case: a sorted array (last-element pivot) forces Θ(n²) comparisons, worse than merge", () => {
    const n = 32;
    const asc = Array.from({ length: n }, (_, i) => i + 1);   // already sorted → maximally unbalanced Lomuto partitions
    const desc = Array.from({ length: n }, (_, i) => n - i);  // reversed → also worst case
    const worst = (n * (n - 1)) / 2;                          // n(n-1)/2 comparisons for fully unbalanced partitioning
    expect(ALGOS.quick(asc).comparisons).toBe(worst);
    expect(ALGOS.quick(desc).comparisons).toBeGreaterThanOrEqual(worst);
    // and the pathological input makes quicksort do MORE comparisons than merge, inverting their usual ranking
    expect(ALGOS.quick(asc).comparisons).toBeGreaterThan(ALGOS.merge(asc).comparisons);
  });
});
