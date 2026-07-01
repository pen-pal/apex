import { describe, it, expect } from 'vitest';
import { build, has, inorder, height, valid, priority, type TNode } from '../src/web/treap';

const shape = (n: TNode | null): string => (n ? `(${n.key}${shape(n.left)}${shape(n.right)})` : '.');

describe('both invariants hold', () => {
  it('BST order on keys and max-heap order on priorities', () => {
    const t = build([5, 3, 8, 1, 7, 9, 2, 6]);
    expect(valid(t)).toBe(true);
    expect(inorder(t)).toEqual([1, 2, 3, 5, 6, 7, 8, 9]); // sorted
  });
  it('stays valid over many random insertions', () => {
    let s = 1; const rk = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % 5000; };
    const keys = new Set<number>(); while (keys.size < 800) keys.add(rk());
    const t = build([...keys]);
    expect(valid(t)).toBe(true);
    expect(inorder(t)).toEqual([...keys].sort((a, b) => a - b));
    for (const k of keys) expect(has(t, k)).toBe(true);
    expect(has(t, 999999)).toBe(false);
  });
  it('ignores duplicate inserts (set semantics)', () => {
    const t = build([4, 4, 4, 2, 2]);
    expect(inorder(t)).toEqual([2, 4]);
  });
});

describe('the shape depends only on the key SET, not insertion order', () => {
  it('the same keys inserted in different orders build the identical tree', () => {
    const a = build([5, 3, 8, 1, 7, 9, 2, 6]);
    const b = build([9, 1, 6, 3, 7, 2, 8, 5]);
    const c = build([1, 2, 3, 5, 6, 7, 8, 9]); // sorted order
    expect(shape(a)).toBe(shape(b));
    expect(shape(a)).toBe(shape(c));
  });
  it('priority is a deterministic function of the key', () => {
    expect(priority(42)).toBe(priority(42));
    expect(priority(42)).not.toBe(priority(43));
  });
});

describe('randomized balance — sorted input does NOT degrade it', () => {
  it('63 sorted keys give a shallow tree, not a length-63 chain', () => {
    const t = build(Array.from({ length: 63 }, (_, i) => i));
    expect(valid(t)).toBe(true);
    expect(height(t)).toBeLessThan(24); // a plain BST would be height 63
  });
  it('height grows ~logarithmically, staying within a small factor of ideal', () => {
    let s = 7; const rk = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % 1000000; };
    const keys = new Set<number>(); while (keys.size < 2000) keys.add(rk());
    const h = height(build([...keys]));
    expect(h).toBeLessThan(4 * Math.log2(2000)); // ideal ≈ 11; well under 4×
  });
});
