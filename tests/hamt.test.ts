import { describe, it, expect } from 'vitest';
import { emptyNode, get, set, entries, sharedNodes, popcount, hash, type Node } from '../src/web/hamt';

const KEYS = ['apple', 'banana', 'cherry', 'date', 'fig', 'grape', 'kiwi', 'lemon', 'mango', 'pear', 'plum', 'berry'];
function build(): { root: Node; ref: Map<string, number> } {
  let root = emptyNode(); const ref = new Map<string, number>();
  KEYS.forEach((k, i) => { root = set(root, k, i * 10); ref.set(k, i * 10); });
  return { root, ref };
}

describe('it behaves like a map', () => {
  it('matches a plain Map for get/set over many keys', () => {
    const { root, ref } = build();
    for (const k of KEYS) expect(get(root, k)).toBe(ref.get(k));
    expect(get(root, 'absent')).toBeUndefined();
    expect(entries(root).length).toBe(ref.size);
  });
  it('set on an existing key replaces the value', () => {
    let root = set(set(emptyNode(), 'x', 1), 'x', 2);
    expect(get(root, 'x')).toBe(2);
    expect(entries(root).length).toBe(1);
  });
  it('popcount is correct (the indexing primitive)', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(0b1011)).toBe(3);
    expect(popcount(0xffffffff)).toBe(32);
  });
});

describe('full 32-bit hash collisions go to a bucket (both keys retrievable)', () => {
  it("stores and retrieves two keys with the same FNV-1a hash, and get() agrees with entries()", () => {
    // 'e4i911' and '1uomk' both hash to 2518975656 (found by the audit)
    expect(hash('e4i911')).toBe(hash('1uomk'));
    let root = set(set(emptyNode(), 'e4i911', 111), '1uomk', 222);
    expect(get(root, 'e4i911')).toBe(111);
    expect(get(root, '1uomk')).toBe(222);
    expect(entries(root).length).toBe(2);
    for (const e of entries(root)) expect(get(root, e.key)).toBe(e.value); // no entries/get disagreement
  });
  it('updating one colliding key leaves the other intact', () => {
    let root = set(set(emptyNode(), 'e4i911', 111), '1uomk', 222);
    root = set(root, 'e4i911', 333);
    expect(get(root, 'e4i911')).toBe(333);
    expect(get(root, '1uomk')).toBe(222);
    expect(entries(root).length).toBe(2);
  });
});

describe('persistence — updates never mutate the old version', () => {
  it('the old root still sees the old value after an update', () => {
    const { root } = build();
    const before = get(root, 'cherry');
    const root2 = set(root, 'cherry', 999);
    expect(get(root2, 'cherry')).toBe(999); // new version updated
    expect(get(root, 'cherry')).toBe(before); // OLD version unchanged
  });
  it('inserting into a derived version leaves earlier versions intact', () => {
    const { root } = build();
    const root2 = set(root, 'cherry', 999);
    const root3 = set(root2, 'newkey', 42);
    expect(entries(root).length).toBe(12);
    expect(entries(root2).length).toBe(12);
    expect(entries(root3).length).toBe(13);
    expect(get(root, 'newkey')).toBeUndefined();
    expect(get(root2, 'newkey')).toBeUndefined();
    expect(get(root3, 'newkey')).toBe(42);
  });
});

describe('structural sharing — the point of a HAMT', () => {
  it('an update copies only the path and shares the rest', () => {
    const { root } = build();
    const root2 = set(root, 'cherry', 999);
    const s = sharedNodes(root, root2);
    expect(s.copied).toBeGreaterThan(0);       // some nodes on the path were copied
    expect(s.shared).toBeGreaterThan(s.copied); // but most of the tree is reused
    expect(root2).not.toBe(root);              // new root object
  });
  it('unrelated subtrees are the SAME objects in old and new roots', () => {
    const { root } = build();
    const root2 = set(root, 'cherry', 999);
    // at least one top-level child is shared by identity between the versions
    const shared = root2.children.some((c) => !('key' in c) && root.children.includes(c));
    const anyShared = shared || sharedNodes(root, root2).shared > 0;
    expect(anyShared).toBe(true);
  });
});
