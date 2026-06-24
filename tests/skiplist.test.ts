import { describe, it, expect } from 'vitest';
import { create, insert, search, toArray, heights, type SkipList } from '../src/web/skiplist';

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
    // a level-0 linear scan would visit ~9 nodes; the express lanes cut that down
    expect(r.hops).toBeLessThan(toArray(list).length);
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
