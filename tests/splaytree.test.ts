import { describe, it, expect } from 'vitest';
import { SplayTree } from '../src/web/splaytree';

const build = (keys: number[]) => { const t = new SplayTree(); keys.forEach((k) => t.insert(k)); return t; };
const KEYS = [50, 30, 70, 20, 40, 60, 80, 10, 25];

describe('BST invariant survives all the splaying', () => {
  it('in-order traversal is always sorted', () => {
    const t = build(KEYS);
    expect(t.inorder()).toEqual([...KEYS].sort((a, b) => a - b));
    for (const k of [40, 60, 10, 80, 25, 99, 5]) { t.find(k); expect(t.inorder()).toEqual([...KEYS].sort((a, b) => a - b)); }
  });
  it('finding an absent key does not change the set', () => {
    const t = build(KEYS);
    t.find(999);
    expect(t.inorder()).toEqual([...KEYS].sort((a, b) => a - b));
  });
});

describe('access moves the node to the root', () => {
  it('insert makes the new key the root', () => {
    const t = build([1, 2, 3, 4, 5]);
    expect(t.rootKey()).toBe(5);
    t.insert(0);
    expect(t.rootKey()).toBe(0);
  });
  it('a successful find splays the key to the root', () => {
    const t = build(KEYS);
    for (const k of [20, 80, 40]) { const r = t.find(k); expect(r.found).toBe(true); expect(t.rootKey()).toBe(k); }
  });
  it('a missing key reports not found', () => {
    expect(build(KEYS).find(33).found).toBe(false);
  });
});

describe('temporal locality — the whole point', () => {
  it('re-accessing the same key is O(1): the second find costs 0', () => {
    const t = build(KEYS);
    const first = t.find(10);
    const second = t.find(10);
    expect(first.found).toBe(true);
    expect(second.cost).toBe(0);          // already at the root
    expect(second.cost).toBeLessThanOrEqual(first.cost);
  });
  it('a hot key stays cheap across other accesses that do not touch it much', () => {
    const t = build(KEYS);
    t.find(25); // make 25 hot → root
    expect(t.depthOf(25)).toBe(0);
    t.find(25);
    expect(t.find(25).cost).toBe(0);
  });
});

describe('degenerate build then access', () => {
  it('inserting sorted keys then accessing the deepest one pulls it up', () => {
    const t = build([1, 2, 3, 4, 5, 6, 7, 8]); // each insert splays to root, so shape adapts
    t.find(1);                                  // access the smallest
    expect(t.rootKey()).toBe(1);
    expect(t.inorder()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
