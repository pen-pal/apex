import { describe, it, expect } from 'vitest';
import { create, push, pop, peek, isValid, drain, type Heap } from '../src/web/heap';

const build = (vals: number[]): Heap => { const h = create(); for (const v of vals) push(h, v); return h; };

describe('heap insertion (sift up)', () => {
  it('keeps the minimum at the root', () => {
    const h = create();
    push(h, 5); expect(peek(h)).toBe(5);
    push(h, 3); expect(peek(h)).toBe(3); // 3 sifts above 5
    push(h, 8); expect(peek(h)).toBe(3);
    push(h, 1); expect(peek(h)).toBe(1); // 1 sifts to the root
  });

  it('maintains the heap property for any insertion order', () => {
    for (const seq of [[5, 3, 8, 1, 9, 2], [1, 2, 3, 4, 5], [5, 4, 3, 2, 1], [7, 7, 7, 1, 9]])
      expect(isValid(build(seq))).toBe(true);
  });

  it('records the sift-up path', () => {
    const h = build([5, 3, 8]); // array [3,5,8]
    const path = push(h, 1);    // 1 appended at index 3, sifts up to root
    expect(path[0]).toBe(3);
    expect(path[path.length - 1]).toBe(0); // reached the root
  });
});

describe('remove-min (sift down)', () => {
  it('pops elements in ascending order', () => {
    const h = build([5, 3, 8, 1, 9, 2]);
    const out: number[] = [];
    let r = pop(h);
    while (r.min !== null) { out.push(r.min); r = pop(h); }
    expect(out).toEqual([1, 2, 3, 5, 8, 9]);
  });

  it('stays valid after each pop', () => {
    const h = build([9, 4, 7, 1, 8, 3, 6, 2, 5]);
    while (h.data.length > 1) { pop(h); expect(isValid(h)).toBe(true); }
  });

  it('pop on an empty heap returns null', () => {
    expect(pop(create()).min).toBe(null);
    expect(peek(create())).toBe(null);
  });
});

describe('heapsort via drain', () => {
  it('sorts via push-all then pop-all', () => {
    expect(drain(build([3, 1, 4, 1, 5, 9, 2, 6]))).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
  });
});
