import { describe, it, expect } from 'vitest';
import { BloomFilter, positions, measureFpRate } from '../src/web/bloom';

describe('positions', () => {
  it('produces k indices within [0, m) deterministically', () => {
    const ps = positions('hello', 100, 4);
    expect(ps).toHaveLength(4);
    expect(ps.every((p) => p >= 0 && p < 100)).toBe(true);
    expect(positions('hello', 100, 4)).toEqual(ps); // deterministic
  });
});

describe('BloomFilter core guarantees', () => {
  it('NEVER has a false negative — everything added queries possibly-present', () => {
    const bf = new BloomFilter(512, 4);
    const items = Array.from({ length: 80 }, (_, i) => `item-${i}`);
    items.forEach((x) => bf.add(x));
    for (const x of items) expect(bf.query(x).verdict).toBe('possibly');
  });

  it('reports definitely-not for an item whose bits are not all set', () => {
    const bf = new BloomFilter(2048, 5); // sparse → most absent items read definitely-not
    bf.add('apple');
    bf.add('banana');
    // a fresh item is very likely to have at least one zero bit here
    const q = bf.query('zzzz-not-added');
    expect(q.verdict).toBe('definitely-not');
    expect(q.allSet).toBe(false);
  });

  it('a definitely-not verdict means at least one queried bit is 0', () => {
    const bf = new BloomFilter(1024, 4);
    bf.add('x');
    const q = bf.query('y-probably-absent');
    if (q.verdict === 'definitely-not') {
      expect(q.positions.some((p) => bf.bits[p] === 0)).toBe(true);
    }
  });
});

describe('false-positive rate rises as the filter fills', () => {
  const absent = Array.from({ length: 1000 }, (_, i) => `absent-${i}`);
  const present = Array.from({ length: 2000 }, (_, i) => `present-${i}`);
  it('an empty filter has ~0 FP; a full one has many more', () => {
    const bf = new BloomFilter(1024, 4);
    const empty = measureFpRate(bf, absent);
    expect(empty).toBe(0); // nothing set → nothing collides
    for (let i = 0; i < 400; i++) bf.add(present[i]);
    const loaded = measureFpRate(bf, absent);
    expect(loaded).toBeGreaterThan(empty); // FP rate climbed with load
  });
  it('the measured FP rate tracks the theoretical (1−e^(−kn/m))^k', () => {
    const bf = new BloomFilter(2048, 5);
    for (let i = 0; i < 200; i++) bf.add(present[i]);
    const measured = measureFpRate(bf, absent);
    const theory = bf.theoreticalFpRate();
    // they should be in the same ballpark (within a few percentage points)
    expect(Math.abs(measured - theory)).toBeLessThan(0.06);
  });
  it('more hashes on a tiny array saturates the bits → high FP', () => {
    const bf = new BloomFilter(64, 6);
    for (let i = 0; i < 30; i++) bf.add(present[i]);
    expect(measureFpRate(bf, absent)).toBeGreaterThan(0.3); // crammed → unreliable
  });
});
