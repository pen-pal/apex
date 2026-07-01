import { describe, it, expect } from 'vitest';
import { buildAlias, sample, effectiveProbability } from '../src/web/aliasmethod';

const dists = [
  [1, 1, 2, 4],
  [5, 1],
  [1, 1, 1, 1],
  [3, 1, 4, 1, 5, 9, 2, 6],
  [10, 0, 0, 0], // one outcome takes everything
];

describe('alias method — the table reproduces the exact weights', () => {
  it('effective probability equals weight/total for every outcome', () => {
    for (const w of dists) {
      const t = buildAlias(w);
      const total = w.reduce((a, b) => a + b, 0);
      w.forEach((wi, j) => expect(effectiveProbability(t, j)).toBeCloseTo(wi / total, 9));
    }
  });
  it('the effective probabilities sum to 1', () => {
    for (const w of dists) {
      const t = buildAlias(w);
      const sum = w.map((_, j) => effectiveProbability(t, j)).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 9);
    }
  });
  it('a uniform distribution needs no aliases (every prob = 1)', () => {
    expect(buildAlias([1, 1, 1, 1]).prob.every((p) => Math.abs(p - 1) < 1e-9)).toBe(true);
  });
});

describe('the table is well-formed', () => {
  it('every prob is in [0,1] and every alias is a valid index', () => {
    for (const w of dists) {
      const t = buildAlias(w);
      expect(t.prob.length).toBe(w.length);
      t.prob.forEach((p) => { expect(p).toBeGreaterThanOrEqual(-1e-9); expect(p).toBeLessThanOrEqual(1 + 1e-9); });
      t.alias.forEach((a) => { expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(t.n); });
    }
  });
});

describe('sampling is two O(1) lookups', () => {
  const t = buildAlias([1, 1, 2, 4]); // prob [.5,.5,1,1], alias [3,3,0,0]
  it('coin below prob keeps the bucket; above takes the alias', () => {
    expect(sample(t, 0, 0.3)).toBe(0);   // 0.3 < prob[0]=0.5 → bucket 0
    expect(sample(t, 0, 0.7)).toBe(3);   // 0.7 ≥ 0.5 → alias[0]=3
    expect(sample(t, 2, 0.9)).toBe(2);   // prob[2]=1 → always the bucket itself
  });
  it('a full Monte-Carlo pass over all bucket×coin combos matches the weights', () => {
    // integrate: each bucket is 1/n; within it, fraction prob[i] → i, (1-prob[i]) → alias[i]
    const n = t.n;
    const tally = new Array(n).fill(0);
    for (let b = 0; b < n; b++) {
      tally[b] += t.prob[b] / n;
      tally[t.alias[b]] += (1 - t.prob[b]) / n;
    }
    expect(tally.map((x) => Math.round(x * 8))).toEqual([1, 1, 2, 4]); // back to the original weights (×8)
  });
});
