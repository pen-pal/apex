import { describe, it, expect } from 'vitest';
import { create, insert, remove, search, toArray, heights, type SkipList } from '../src/web/skiplist';

// build a deterministic skip list: [key, height] pairs
function build(entries: [number, number][], maxLevel = 4): SkipList {
  const l = create(maxLevel);
  for (const [k, h] of entries) insert(l, k, h);
  return l;
}

describe('skip list structure', () => {
  const list = build([[3, 1], [6, 4], [7, 1], [9, 2], [12, 1], [17, 3], [19, 2], [21, 1], [25, 4], [26, 1]]);

  it('level 0 holds every key in sorted order', () => {
    expect(toArray(list)).toEqual([3, 6, 7, 9, 12, 17, 19, 21, 25, 26]);
  });

  it('each key reaches exactly its assigned height', () => {
    const h = heights(list);
    expect(h[6]).toBe(4);
    expect(h[17]).toBe(3);
    expect(h[9]).toBe(2);
    expect(h[3]).toBe(1);
  });
});

describe('search', () => {
  const list = build([[3, 1], [6, 4], [7, 1], [9, 2], [12, 1], [17, 3], [19, 2], [21, 1], [25, 4], [26, 1]]);

  it('finds present keys and rejects absent ones', () => {
    expect(search(list, 19).found).toBe(true);
    expect(search(list, 17).found).toBe(true);
    expect(search(list, 18).found).toBe(false);
    expect(search(list, 100).found).toBe(false);
    expect(search(list, 1).found).toBe(false);
  });

  it('uses express lanes to skip nodes — fewer hops than a linear scan', () => {
    const r = search(list, 25);
    expect(r.found).toBe(true);
    // the exact express-lane path: drop through 6 (L3), 17 (L2), 19 (L1), 21 (L0), reach 25
    expect(r.visited).toEqual([6, 17, 19, 21, 25]);
    expect(r.hops).toBeLessThan(toArray(list).length); // fewer than a 10-node linear scan
  });

  it('every key is findable regardless of its height', () => {
    for (const k of toArray(list)) expect(search(list, k).found).toBe(true);
  });
});

describe('insertion preserves order', () => {
  it('inserting out of order still yields a sorted level-0 list', () => {
    const l = build([[50, 2], [10, 1], [30, 3], [20, 1], [40, 1], [5, 4]]);
    expect(toArray(l)).toEqual([5, 10, 20, 30, 40, 50]);
    expect(search(l, 30).found).toBe(true);
    expect(search(l, 35).found).toBe(false);
  });
});

describe('deletion removes a key from every level', () => {
  it('removes a tall node from all levels and keeps the list sorted', () => {
    const list = build([[3, 1], [6, 4], [7, 1], [9, 2], [12, 1], [17, 3], [19, 2], [21, 1], [25, 4], [26, 1]]);
    expect(remove(list, 25)).toBe(true); // 25 reached height 4
    expect(toArray(list)).toEqual([3, 6, 7, 9, 12, 17, 19, 21, 26]); // gone from level 0
    expect(search(list, 25).found).toBe(false);
    expect(heights(list)[25]).toBeUndefined(); // gone from every level, not just level 0
    expect(search(list, 26).found).toBe(true); // neighbours still linked
  });
  it('removing an absent key is a no-op', () => {
    const list = build([[5, 2], [10, 1]]);
    expect(remove(list, 99)).toBe(false);
    expect(toArray(list)).toEqual([5, 10]);
  });
  it('insert/delete fuzz matches a sorted Set', () => {
    const list = create(5); const ref = new Set<number>();
    const ops: [string, number, number][] = [['i', 5, 3], ['i', 2, 1], ['i', 8, 4], ['d', 2, 0], ['i', 1, 2], ['d', 8, 0], ['i', 8, 1], ['d', 99, 0]];
    for (const [op, k, h] of ops) {
      if (op === 'i') { if (!ref.has(k)) { insert(list, k, h); ref.add(k); } }
      else { remove(list, k); ref.delete(k); }
    }
    expect(toArray(list)).toEqual([...ref].sort((a, b) => a - b));
  });
});

describe('robustness', () => {
  it('clamps a height of 0 up to level 0 so the key stays searchable', () => {
    const l = create(4); insert(l, 42, 0);
    expect(toArray(l)).toEqual([42]); // present in level 0 despite height 0
    expect(search(l, 42).found).toBe(true);
  });
});
