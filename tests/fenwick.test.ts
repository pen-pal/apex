import { describe, it, expect } from 'vitest';
import { build, update, query, rangeQuery, responsibility } from '../src/web/fenwick';

const A = [3, 2, -1, 6, 5, 4, -3, 3]; // 8 elements
const prefix = (i: number) => A.slice(0, i).reduce((s, x) => s + x, 0);

describe('prefix sums match the naive computation', () => {
  const f = build(A);
  it('query(i) equals the sum of the first i elements', () => {
    for (let i = 0; i <= A.length; i++) expect(query(f, i).sum).toBe(prefix(i));
  });
  it('hand-checked values', () => {
    expect(query(f, 4).sum).toBe(10); // 3+2-1+6
    expect(query(f, 6).sum).toBe(19); // +5+4
    expect(query(f, 8).sum).toBe(19); // -3+3 nets 0
  });
});

describe('point update reflects in later queries', () => {
  it('adding to an element changes the prefix sums that include it', () => {
    const f = build(A);
    update(f, 3, 5); // a[3] += 5
    expect(query(f, 4).sum).toBe(15); // was 10
    expect(query(f, 2).sum).toBe(5);  // unchanged (doesn't include index 3)
  });
});

describe('range queries', () => {
  it('rangeQuery(l, r) sums a[l..r]', () => {
    const f = build(A);
    expect(rangeQuery(f, 2, 5)).toBe(2 - 1 + 6 + 5); // = 12
    expect(rangeQuery(f, 1, 8)).toBe(prefix(8));
    expect(rangeQuery(f, 4, 4)).toBe(6); // single element
  });
});

describe('the binary structure', () => {
  it('update/query touch only ~log n indices (one per set bit)', () => {
    const f = build(A);
    expect(query(f, 7).visited).toEqual([7, 6, 4]); // 7=111 → strip low bits: 7,6,4
    expect(update(f, 5, 0)).toEqual([5, 6, 8]);      // 5=101 → climb: 5,6,8
  });
  it('each node covers a block sized by its lowest set bit', () => {
    expect(responsibility(8)).toEqual([1, 8]); // 8 covers 1..8 (lowbit 8)
    expect(responsibility(6)).toEqual([5, 6]); // 6 covers 5..6 (lowbit 2)
    expect(responsibility(7)).toEqual([7, 7]); // 7 covers just itself (lowbit 1)
  });
});
