import { describe, it, expect } from 'vitest';
import { build, insert, emptyTree, leafScan, height, leafDepths, type Node } from '../src/web/btree';

const ORDER = 4; // ≤ 3 keys per node

describe('B+tree splitting', () => {
  it('a leaf splits on overflow and grows a root (hand-worked)', () => {
    let t = build([1, 2, 3], ORDER); // fits in one leaf
    expect(t).toEqual({ kind: 'leaf', keys: [1, 2, 3] });
    t = insert(t, 4, ORDER); // overflow → split
    expect(t.kind).toBe('internal');
    const root = t as Extract<Node, { kind: 'internal' }>;
    expect(root.keys).toEqual([3]); // right leaf's first key copied up
    expect(leafScan(root)).toEqual([1, 2, 3, 4]);
    expect(height(t)).toBe(2);
  });
});

describe('B+tree invariants over many inserts', () => {
  const keys = [50, 20, 70, 10, 30, 60, 80, 5, 15, 25, 35, 55, 65, 75, 85, 1, 90, 45, 40, 33];
  const t = build(keys, ORDER);

  it('stays balanced — every leaf is at the same depth', () => {
    expect(leafDepths(t).size).toBe(1);
  });

  it('keys read off the leaves in sorted order, with no loss or duplication', () => {
    expect(leafScan(t)).toEqual([...keys].sort((a, b) => a - b));
  });

  it('no node exceeds the fan-out (≤ order-1 keys everywhere)', () => {
    const check = (n: Node): void => {
      expect(n.keys.length).toBeLessThanOrEqual(ORDER - 1);
      if (n.kind === 'internal') {
        expect(n.children.length).toBe(n.keys.length + 1); // k separators → k+1 children
        n.children.forEach(check);
      }
    };
    check(t);
  });

  it('separator keys correctly partition their subtrees', () => {
    const check = (n: Node): void => {
      if (n.kind === 'internal') {
        n.keys.forEach((sep, i) => {
          expect(Math.max(...leafScan(n.children[i]))).toBeLessThan(sep); // left subtree < separator
          expect(Math.min(...leafScan(n.children[i + 1]))).toBeGreaterThanOrEqual(sep); // right ≥ separator
        });
        n.children.forEach(check);
      }
    };
    check(t);
  });
});

describe('duplicates and order', () => {
  it('ignores duplicate keys', () => {
    const t = build([5, 5, 5, 3, 3, 8], ORDER);
    expect(leafScan(t)).toEqual([3, 5, 8]);
  });
  it('an empty tree is a single empty leaf', () => {
    expect(emptyTree()).toEqual({ kind: 'leaf', keys: [] });
    expect(height(emptyTree())).toBe(1);
  });
});
