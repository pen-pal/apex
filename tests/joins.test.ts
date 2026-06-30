import { describe, it, expect } from 'vitest';
import { nestedLoop, hashJoin, sortMerge, sameResult, type Row } from '../src/web/joins';

// customers ⋈ orders on customer id. Note: key 2 appears twice on the left (Bob, Cy).
const R: Row[] = [{ row: 'Ann', key: 1 }, { row: 'Bob', key: 2 }, { row: 'Cy', key: 2 }, { row: 'Dee', key: 4 }];
const S: Row[] = [{ row: 'o100', key: 2 }, { row: 'o101', key: 1 }, { row: 'o102', key: 2 }, { row: 'o103', key: 3 }, { row: 'o104', key: 1 }];
// The 6 matching pairs, hand-enumerated: Ann×{o101,o104}, Bob×{o100,o102}, Cy×{o100,o102}.

describe('nested-loop join', () => {
  const r = nestedLoop(R, S);
  it('compares every pair — exactly |R|·|S|', () => {
    expect(r.comparisons).toBe(4 * 5); // 20
  });
  it('finds all 6 matches', () => {
    expect(r.pairs).toHaveLength(6);
  });
});

describe('hash join', () => {
  const r = hashJoin(R, S);
  it('build touches every S row; probe does one lookup per R row', () => {
    expect(r.buildOps).toBe(5);
    expect(r.probeLookups).toBe(4);
  });
  it('within exact-key buckets, the key comparisons equal the output size (no wasted work)', () => {
    expect(r.probeComparisons).toBe(6);
    expect(r.probeComparisons).toBeLessThan(nestedLoop(R, S).comparisons); // 6 ≪ 20
  });
  it('buckets group S by key', () => {
    expect(r.buckets).toEqual([
      { key: 1, rows: ['o101', 'o104'] },
      { key: 2, rows: ['o100', 'o102'] },
      { key: 3, rows: ['o103'] },
    ]);
  });
});

describe('sort-merge join', () => {
  const r = sortMerge(R, S);
  it('sorts both inputs by key', () => {
    expect(r.sortedR.map((x) => x.key)).toEqual([1, 2, 2, 4]);
    expect(r.sortedS.map((x) => x.key)).toEqual([1, 1, 2, 2, 3]);
  });
  it('the merge sweep does only a handful of key comparisons (after sorting)', () => {
    expect(r.mergeComparisons).toBe(3); // equal@1 → runs; equal@2 → runs; 4>3 → advance j, S exhausted
  });
});

describe('all three algorithms agree (correctness cross-check)', () => {
  it('produce the identical join result (order aside)', () => {
    const a = nestedLoop(R, S).pairs, b = hashJoin(R, S).pairs, c = sortMerge(R, S).pairs;
    expect(sameResult(a, b)).toBe(true);
    expect(sameResult(a, c)).toBe(true);
    expect(a).toHaveLength(6);
  });
  it('an empty side yields no rows from any algorithm', () => {
    expect(nestedLoop(R, []).pairs).toHaveLength(0);
    expect(hashJoin([], S).pairs).toHaveLength(0);
    expect(sortMerge(R, []).pairs).toHaveLength(0);
  });
});
