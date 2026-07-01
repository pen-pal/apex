import { describe, it, expect } from 'vitest';
import { meld, insert, findMin, deleteMin, fromKeys, drain, isHeap } from '../src/web/pairingheap';

describe('meld and the heap invariant', () => {
  it('find-min is the root and the heap order holds everywhere', () => {
    const h = fromKeys([5, 3, 8, 1, 9, 2]);
    expect(findMin(h)).toBe(1);
    expect(isHeap(h)).toBe(true);
  });
  it('melding two heaps yields the sorted union', () => {
    const a = fromKeys([4, 2, 6]), b = fromKeys([5, 1, 7]);
    expect(drain(meld(a, b))).toEqual([1, 2, 4, 5, 6, 7]);
  });
  it('meld with an empty heap is the identity', () => {
    const a = fromKeys([3, 1, 2]);
    expect(findMin(meld(null, a))).toBe(1);
    expect(findMin(meld(a, null))).toBe(1);
    expect(deleteMin(null)).toEqual({ min: null, heap: null });
  });
});

describe('heapsort via repeated delete-min', () => {
  it('drains keys in sorted order', () => {
    const keys = [5, 3, 8, 1, 9, 2, 7, 4, 6, 0];
    expect(drain(fromKeys(keys))).toEqual([...keys].sort((a, b) => a - b));
  });
  it('20000 random arrays (with duplicates) drain to sorted and stay heap-ordered', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let run = 0; run < 20000; run++) {
      const n = rnd(40);
      const arr = Array.from({ length: n }, () => rnd(30));
      const h = fromKeys(arr);
      expect(isHeap(h)).toBe(true);
      expect(drain(h)).toEqual([...arr].sort((a, b) => a - b));
    }
  });
});

describe('interleaved inserts and delete-mins match a reference multiset', () => {
  it('5000 random operation sequences', () => {
    let s = 7; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let run = 0; run < 5000; run++) {
      const ref: number[] = []; let h = null as ReturnType<typeof fromKeys>;
      for (let o = 0; o < rnd(30); o++) {
        if (rnd(3) === 0 && ref.length) {
          const { min, heap } = deleteMin(h); h = heap;
          const m = Math.min(...ref); ref.splice(ref.indexOf(m), 1);
          expect(min).toBe(m);
        } else { const k = rnd(100); h = insert(h, k); ref.push(k); }
      }
    }
  });
});
