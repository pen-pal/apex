import { describe, it, expect } from 'vitest';
import { build, buildRecursive, inorder, lca, rmqPos } from '../src/web/cartesian';

const isMinHeap = (t: ReturnType<typeof build>, a: number[]) =>
  t.nodes.every((n) => n.parent < 0 || a[n.parent] <= a[n.i]);

describe('construction', () => {
  it('the root is the position of the array minimum', () => {
    const a = [9, 3, 7, 1, 8, 2, 6, 5, 4];
    expect(build(a).root).toBe(3); // a[3] = 1
  });
  it('is a min-heap by value and a BST by index (in-order = the array)', () => {
    const a = [9, 3, 7, 1, 8, 2, 6, 5, 4];
    const t = build(a);
    expect(isMinHeap(t, a)).toBe(true);
    expect(inorder(t)).toEqual([...a.keys()]);
  });
  it('the O(n) stack build equals the recursive (argmin) build', () => {
    const a = [5, 2, 8, 6, 1, 9, 3, 7, 4, 0];
    expect(build(a)).toEqual(buildRecursive(a));
  });
});

describe('the RMQ = LCA equivalence', () => {
  it('a[lca(i,j)] is the minimum of a[i..j] for every range', () => {
    const a = [9, 3, 7, 1, 8, 2, 6, 5, 4];
    const t = build(a);
    for (let i = 0; i < a.length; i++)
      for (let j = i; j < a.length; j++)
        expect(a[rmqPos(t, i, j)]).toBe(Math.min(...a.slice(i, j + 1)));
  });
  it('lca is symmetric and lca(i,i) = i', () => {
    const t = build([4, 1, 3, 2, 5]);
    expect(lca(t, 0, 4)).toBe(lca(t, 4, 0));
    for (let i = 0; i < 5; i++) expect(lca(t, i, i)).toBe(i);
  });
});

describe('agrees with brute force over random arrays (fuzz)', () => {
  it('3000 arrays: build == recursive, in-order == array, RMQ == LCA', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let run = 0; run < 3000; run++) {
      const n = 1 + rnd(30);
      const a = Array.from({ length: n }, () => rnd(50)); // duplicates likely
      const t = build(a);
      expect(t).toEqual(buildRecursive(a));
      expect(inorder(t)).toEqual([...a.keys()]);
      for (let i = 0; i < n; i++)
        for (let j = i; j < n; j++)
          expect(a[rmqPos(t, i, j)]).toBe(Math.min(...a.slice(i, j + 1)));
    }
  });
});
