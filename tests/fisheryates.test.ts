import { describe, it, expect } from 'vitest';
import { makeRng, fisherYates, naiveShuffle, distribution, maxBias, isPermutation } from '../src/web/fisheryates';

const N = 5, TRIALS = 40000;

describe('both shuffles produce valid permutations', () => {
  it('every run is a permutation (the naive one is biased, not broken)', () => {
    for (let t = 0; t < 500; t++) {
      const a = Array.from({ length: N }, (_, i) => i);
      const b = a.slice();
      fisherYates(a, makeRng(t));
      naiveShuffle(b, makeRng(t + 1));
      expect(isPermutation(a)).toBe(true);
      expect(isPermutation(b)).toBe(true);
    }
  });
});

describe('Fisher–Yates is uniform; the naive shuffle is provably biased', () => {
  const fy = distribution(fisherYates, N, TRIALS, makeRng(1));
  const nv = distribution(naiveShuffle, N, TRIALS, makeRng(1));

  it('Fisher–Yates: every (position, value) cell is ~1/n', () => {
    expect(maxBias(fy, N)).toBeLessThan(0.06); // within sampling noise of uniform
    for (const row of fy) for (const p of row) expect(p).toBeCloseTo(1 / N, 1);
  });
  it('naive shuffle: some cells deviate far from 1/n', () => {
    expect(maxBias(nv, N)).toBeGreaterThan(0.1); // >10% off uniform — real, structural bias
  });
  it('the biased distribution is not uniform where the uniform one is', () => {
    // in the naive shuffle, position 0 favors small values and disfavors the largest
    const row0 = nv[0];
    expect(row0[1]).toBeGreaterThan(row0[N - 1]); // value 1 lands at pos 0 more often than value n-1
    expect(Math.max(...row0) - Math.min(...row0)).toBeGreaterThan(0.03);
  });
  it('each ROW and COLUMN still sums to 1 (it is a permutation distribution)', () => {
    for (const row of nv) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    for (let c = 0; c < N; c++) expect(nv.reduce((s, row) => s + row[c], 0)).toBeCloseTo(1, 5);
  });
});

describe('the PRNG is deterministic', () => {
  it('same seed → same shuffle', () => {
    const a = [0, 1, 2, 3, 4], b = [0, 1, 2, 3, 4];
    fisherYates(a, makeRng(99));
    fisherYates(b, makeRng(99));
    expect(a).toEqual(b);
  });
});
