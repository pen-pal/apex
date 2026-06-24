import { describe, it, expect } from 'vitest';
import { create, find, union, connected, groups } from '../src/web/unionfind';

describe('union and connectivity', () => {
  it('starts with every element in its own set', () => {
    const d = create(5);
    expect(d.count).toBe(5);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) expect(connected(d, i, j)).toBe(i === j);
  });

  it('union merges sets and reduces the component count', () => {
    const d = create(5);
    union(d, 0, 1);
    union(d, 2, 3);
    expect(d.count).toBe(3);            // {0,1} {2,3} {4}
    expect(connected(d, 0, 1)).toBe(true);
    expect(connected(d, 0, 2)).toBe(false);
    union(d, 1, 2);                     // merges the two pairs
    expect(connected(d, 0, 3)).toBe(true);
    expect(d.count).toBe(2);           // {0,1,2,3} {4}
  });

  it('union of already-connected elements is a no-op', () => {
    const d = create(3);
    union(d, 0, 1);
    expect(union(d, 0, 1).merged).toBe(false);
    expect(d.count).toBe(2);
  });
});

describe('union by rank keeps trees shallow', () => {
  it('a chain of unions does not grow a tall tree', () => {
    const d = create(8);
    for (let i = 1; i < 8; i++) union(d, 0, i); // attach all to the same growing set
    // with union by rank the root's rank stays small (≤ log2 n)
    const root = find(d, 0);
    expect(d.rank[root]).toBeLessThanOrEqual(1);
  });
});

describe('path compression flattens on find', () => {
  it('find re-points nodes directly at the root', () => {
    // build a deliberate chain 3→2→1→0 by hand, then compress
    const d = create(4);
    d.parent = [0, 0, 1, 2]; // 3's parent 2, 2's parent 1, 1's parent 0
    expect(find(d, 3)).toBe(0);
    expect(d.parent[3]).toBe(0); // 3 now points straight at the root
    expect(d.parent[2]).toBe(0);
    expect(d.parent[1]).toBe(0);
  });
});

describe('grouping', () => {
  it('reports the current disjoint sets', () => {
    const d = create(6);
    union(d, 0, 2); union(d, 4, 2); union(d, 1, 5);
    const g = Object.values(groups(d)).map((s) => s.sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
    expect(g).toEqual([[0, 2, 4], [1, 5], [3]]);
  });
});
