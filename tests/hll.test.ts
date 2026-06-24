import { describe, it, expect } from 'vitest';
import { create, add, estimate, bucketAndRank, fromItems } from '../src/web/hll';

describe('bucket and rank extraction (hand-worked from the definition)', () => {
  it('top p bits choose the bucket; leftmost 1 of the rest sets the rank', () => {
    // p=4 → top 4 bits = bucket, low 28 bits = w
    expect(bucketAndRank((5 << 28) | (1 << 27), 4)).toEqual({ bucket: 5, rank: 1 });  // leftmost bit set
    expect(bucketAndRank((5 << 28) | (1 << 24), 4)).toEqual({ bucket: 5, rank: 4 });  // 3 leading zeros
    expect(bucketAndRank(5 << 28, 4)).toEqual({ bucket: 5, rank: 29 });               // w all zero → 28+1
    expect(bucketAndRank((0xf << 28) | 1, 4)).toEqual({ bucket: 15, rank: 28 });       // only the last bit set
  });
});

describe('distinct counting', () => {
  it('adding a duplicate never changes the registers (duplicates are free)', () => {
    const a = create(6);
    add(a, 'apple');
    const snapshot = [...a.registers];
    for (let i = 0; i < 50; i++) add(a, 'apple'); // same item many times
    expect(a.registers).toEqual(snapshot); // unchanged → it counts DISTINCT, not total
  });

  it('estimates a small distinct set closely (linear-counting regime)', () => {
    const items = Array.from({ length: 50 }, (_, i) => `user-${i}`); // 50 distinct
    const e = estimate(fromItems(8, items)); // m=256, plenty of headroom
    expect(Math.abs(e - 50) / 50).toBeLessThan(0.15); // within ~15% for this fixed stream
  });

  it('the estimate ignores how many times each item repeats', () => {
    const distinct = ['a', 'b', 'c', 'd', 'e'];
    const withDupes = distinct.flatMap((x) => Array(20).fill(x)); // 100 events, 5 distinct
    expect(estimate(fromItems(8, distinct))).toBe(estimate(fromItems(8, withDupes)));
  });

  it('more distinct items give a larger estimate', () => {
    const small = estimate(fromItems(8, Array.from({ length: 20 }, (_, i) => `x${i}`)));
    const big = estimate(fromItems(8, Array.from({ length: 200 }, (_, i) => `x${i}`)));
    expect(big).toBeGreaterThan(small);
  });
});
