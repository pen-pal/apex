import { describe, it, expect } from 'vitest';
import { weakHash, seededHash, attackKeys, insertCost } from '../src/web/hashflood';

describe('the attack: a predictable hash can be flooded', () => {
  it('attacker keys (multiples of numBuckets) all collide in bucket 0 under weakHash', () => {
    const keys = attackKeys(8, 8);
    expect(keys).toEqual([0, 8, 16, 24, 32, 40, 48, 56]);
    expect(keys.every((k) => weakHash(k, 8) === 0)).toBe(true);
  });
  it('flooding makes the table O(n^2): comparisons = n(n-1)/2', () => {
    for (const n of [8, 16, 64]) {
      const c = insertCost(attackKeys(n, 8), 8, weakHash);
      expect(c.maxBucket).toBe(n);              // one giant chain
      expect(c.comparisons).toBe((n * (n - 1)) / 2);
    }
  });
});

describe('the defense: a seeded (keyed) hash scatters the same keys', () => {
  const SEED = 0x9e3779b9;
  const h = (k: number, b: number) => seededHash(k, b, SEED);

  it('the attacker keys spread across buckets instead of colliding', () => {
    const c = insertCost(attackKeys(64, 16), 16, h);
    expect(c.maxBucket).toBeLessThan(10);        // no giant chain (vs 64 under weakHash)
    expect(c.sizes.reduce((a, b) => a + b, 0)).toBe(64); // every key landed in a valid bucket
  });
  it('seeded cost is far below the flooded weak cost', () => {
    const weak = insertCost(attackKeys(64, 16), 16, weakHash);
    const seeded = insertCost(attackKeys(64, 16), 16, h);
    expect(seeded.comparisons).toBeLessThan(weak.comparisons / 5);
  });
  it('always returns a valid bucket index in [0, buckets) — no negative/NaN', () => {
    for (let k = 0; k < 500; k++) {
      const b = seededHash(k * 7919, 16, SEED);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(16);
      expect(Number.isInteger(b)).toBe(true);
    }
  });
  it('a different seed gives a different layout (the attacker cannot precompute it)', () => {
    const a = insertCost(attackKeys(32, 16), 16, (k, b) => seededHash(k, b, 1));
    const b = insertCost(attackKeys(32, 16), 16, (k, b) => seededHash(k, b, 2));
    expect(a.sizes).not.toEqual(b.sizes);
  });
});

describe('weakHash basics', () => {
  it('handles the modulo cleanly', () => {
    expect(weakHash(20, 8)).toBe(4);
    expect(weakHash(0, 8)).toBe(0);
  });
});
