import { describe, it, expect } from 'vitest';
import { build, insert, remove, emptyTree, leafScan, height, leafDepths, type Node } from '../src/web/btree';

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

// Full B+tree invariant check, anchored to the textbook definition (balanced, sorted, fan-out
// bounded above AND below for every non-root node, separators partition correctly).
function assertInvariants(root: Node, order: number, expected: number[]): void {
  expect(leafScan(root)).toEqual(expected); // sorted, no loss/dup
  expect(leafDepths(root).size).toBeLessThanOrEqual(1); // balanced (or a single empty leaf)
  const minLeaf = Math.floor(order / 2);
  const minInternal = Math.ceil(order / 2) - 1;
  const walk = (n: Node, isRoot: boolean): void => {
    expect(n.keys.length).toBeLessThanOrEqual(order - 1); // fan-out ceiling
    if (!isRoot) expect(n.keys.length).toBeGreaterThanOrEqual(n.kind === 'leaf' ? minLeaf : minInternal); // occupancy floor
    if (n.kind === 'internal') {
      expect(n.children.length).toBe(n.keys.length + 1);
      n.keys.forEach((sep, i) => {
        expect(Math.max(...leafScan(n.children[i]))).toBeLessThan(sep);
        expect(Math.min(...leafScan(n.children[i + 1]))).toBeGreaterThanOrEqual(sep);
      });
      n.children.forEach((c) => walk(c, false));
    }
  };
  walk(root, true);
}

describe('B+tree deletion (borrow / merge / collapse)', () => {
  it('deleting from a leaf with spare keys just removes the key', () => {
    const t = remove(build([1, 2, 3, 4, 5], ORDER), 3, ORDER);
    expect(leafScan(t)).toEqual([1, 2, 4, 5]);
  });

  it('deleting a missing key is a no-op', () => {
    const before = build([10, 20, 30], ORDER);
    expect(leafScan(remove(before, 99, ORDER))).toEqual([10, 20, 30]);
  });

  it('underflow borrows from a sibling rather than merging when it can', () => {
    // force a tall tree, then delete to trigger a borrow; invariants must hold throughout
    let t = build([10, 20, 30, 40, 50, 60, 70, 80], ORDER);
    t = remove(t, 10, ORDER);
    assertInvariants(t, ORDER, [20, 30, 40, 50, 60, 70, 80]);
  });

  it('collapses the root a level when the tree shrinks enough', () => {
    let t = build([1, 2, 3, 4, 5, 6, 7], ORDER);
    const h0 = height(t);
    for (const k of [1, 2, 3, 4]) t = remove(t, k, ORDER);
    expect(leafScan(t)).toEqual([5, 6, 7]);
    expect(height(t)).toBeLessThan(h0); // got shorter
    assertInvariants(t, ORDER, [5, 6, 7]);
  });

  it('stays a valid B+tree across a full delete-everything sweep, for several orders', () => {
    for (const order of [3, 4, 5]) {
      const keys = Array.from({ length: 24 }, (_, i) => (i * 7 + 3) % 100).filter((v, i, a) => a.indexOf(v) === i);
      let t = build(keys, order);
      const remaining = [...keys].sort((a, b) => a - b);
      // delete in a rotated order to exercise borrow, merge and cascading underflow
      const delOrder = keys.slice(5).concat(keys.slice(0, 5));
      for (const k of delOrder) {
        t = remove(t, k, order);
        remaining.splice(remaining.indexOf(k), 1);
        assertInvariants(t, order, remaining);
      }
      expect(leafScan(t)).toEqual([]); // emptied
    }
  });
});
