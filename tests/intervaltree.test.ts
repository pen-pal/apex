import { describe, it, expect } from 'vitest';
import { build, search, brute, insert, inorder, type Interval } from '../src/web/intervaltree';

const EVENTS: Interval[] = [[1, 5], [3, 8], [6, 10], [12, 15], [14, 20]];

describe('overlap queries', () => {
  it('finds every interval overlapping the query range', () => {
    expect(search(build(EVENTS), 4, 7).hits).toEqual([[1, 5], [3, 8], [6, 10]]);
    expect(search(build(EVENTS), 11, 13).hits).toEqual([[12, 15]]);
    expect(search(build(EVENTS), 21, 25).hits).toEqual([]); // nothing reaches that far
  });
  it('a touching endpoint counts as an overlap (closed intervals)', () => {
    expect(search(build([[1, 5]]), 5, 9).hits).toEqual([[1, 5]]); // [1,5] and [5,9] share point 5
    expect(search(build([[1, 5]]), 6, 9).hits).toEqual([]);       // [1,5] and [6,9] do not
  });
});

describe('the augmented max endpoint', () => {
  it('each node stores the maximum high endpoint in its subtree', () => {
    // insert in a fixed order and check the root/subtree maxes
    let root = null as ReturnType<typeof build>;
    for (const [lo, hi] of [[10, 12], [5, 30], [15, 18]] as Interval[]) root = insert(root, lo, hi);
    expect(root!.lo).toBe(10);
    expect(root!.max).toBe(30);              // subtree contains [5,30]
    expect(root!.left!.max).toBe(30);        // the [5,30] node
    expect(root!.right!.max).toBe(18);
  });
  it('inorder traversal is sorted by low endpoint (it is a BST on lo)', () => {
    const los = inorder(build(EVENTS)).map((n) => n.lo);
    expect(los).toEqual([...los].sort((a, b) => a - b));
  });
});

describe('agrees with brute force everywhere', () => {
  it('3000 random interval sets and queries match, and pruning visits fewer than all nodes', () => {
    let s = 5; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    let totalVisited = 0, totalNodes = 0;
    for (let t = 0; t < 3000; t++) {
      const n = 1 + rnd(20);
      const iv: Interval[] = Array.from({ length: n }, () => { const lo = rnd(100); return [lo, lo + rnd(20)]; });
      const root = build(iv);
      const qLo = rnd(100), qHi = qLo + rnd(15);
      const got = search(root, qLo, qHi);
      expect(got.hits).toEqual(brute(iv, qLo, qHi));
      totalVisited += got.visited; totalNodes += n;
    }
    expect(totalVisited).toBeLessThan(totalNodes); // pruning skips some subtrees overall
  });
});
