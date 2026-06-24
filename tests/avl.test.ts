import { describe, it, expect } from 'vitest';
import { build, insert, inorder, isAvl, height, balanceFactor, type Node } from '../src/web/avl';

describe('the four rotation cases', () => {
  it('LL: inserting 3,2,1 rotates right → root 2', () => {
    const t = build([3, 2, 1])!;
    expect(t.key).toBe(2); expect(t.left!.key).toBe(1); expect(t.right!.key).toBe(3);
  });
  it('RR: inserting 1,2,3 rotates left → root 2', () => {
    const t = build([1, 2, 3])!;
    expect(t.key).toBe(2); expect(t.left!.key).toBe(1); expect(t.right!.key).toBe(3);
  });
  it('LR: inserting 3,1,2 → root 2', () => {
    const t = build([3, 1, 2])!;
    expect(t.key).toBe(2); expect(t.left!.key).toBe(1); expect(t.right!.key).toBe(3);
  });
  it('RL: inserting 1,3,2 → root 2', () => {
    const t = build([1, 3, 2])!;
    expect(t.key).toBe(2); expect(t.left!.key).toBe(1); expect(t.right!.key).toBe(3);
  });
});

describe('invariants over many inserts', () => {
  it('stays a valid AVL tree and in-order is sorted', () => {
    const keys = [50, 20, 70, 10, 30, 60, 80, 5, 15, 25, 35, 1, 100, 45, 40, 33, 12, 8];
    const t = build(keys)!;
    expect(isAvl(t)).toBe(true);
    expect(inorder(t)).toEqual([...keys].sort((a, b) => a - b));
  });

  it('stays valid after each successive insert', () => {
    let t: Node | null = null;
    for (let i = 1; i <= 31; i++) { t = insert(t, i); expect(isAvl(t)).toBe(true); } // sorted input = worst case
    expect(height(t)).toBeLessThanOrEqual(6); // 31 nodes → height ≤ ~1.44·log2(32) ≈ 7, AVL gives 5–6
  });

  it('every balance factor stays within ±1', () => {
    const t = build([4, 2, 6, 1, 3, 5, 7, 8, 9, 10])!;
    const check = (n: Node | null): void => { if (n) { expect(Math.abs(balanceFactor(n))).toBeLessThanOrEqual(1); check(n.left); check(n.right); } };
    check(t);
  });
});

describe('basics', () => {
  it('ignores duplicate keys', () => {
    expect(inorder(build([5, 3, 5, 3, 8])!)).toEqual([3, 5, 8]);
  });
  it('sorted input does NOT degrade into a chain (the whole point)', () => {
    const t = build([1, 2, 3, 4, 5, 6, 7])!;
    expect(height(t)).toBe(3);  // a balanced tree of 7 nodes, not a height-7 chain
  });
});
