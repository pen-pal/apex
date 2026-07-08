import { describe, it, expect } from 'vitest';
import { fitLinear, predict, maxError, searchWindow, binarySearchCost } from '../src/web/learnedindex';

// Independent oracle: least-squares regression + the error bound, checked against hand math and known properties, not
// the implementation's own output. Perfectly linear keys (i·10) must fit slope 0.1, intercept 0, and predict each key's
// exact index → zero error. The fit minimises squared error (adding the residuals' relationship). Clustered keys give a
// larger search window than uniform. Binary search is ceil(log2 n).

describe('fit on perfectly linear keys is exact', () => {
  const keys = Array.from({ length: 10 }, (_, i) => i * 10); // 0,10,...,90 → index i = key/10
  const m = fitLinear(keys);
  it('recovers slope 0.1 and intercept 0', () => {
    expect(m.slope).toBeCloseTo(0.1, 10);
    expect(m.intercept).toBeCloseTo(0, 10);
  });
  it('predicts each key’s exact position, so the error bound is zero', () => {
    for (let i = 0; i < keys.length; i++) expect(predict(m, keys[i], keys.length)).toBe(i);
    expect(maxError(keys, m)).toBe(0);
    expect(searchWindow(keys, m)).toBe(1); // 2*0+1
  });
});

describe('the fit minimises squared error', () => {
  it('no other line beats the least-squares line on total squared residual', () => {
    const keys = [1, 2, 5, 8, 13, 21]; // not perfectly linear
    const m = fitLinear(keys);
    const sse = (slope: number, intercept: number) =>
      keys.reduce((s, k, i) => s + (slope * k + intercept - i) ** 2, 0);
    const best = sse(m.slope, m.intercept);
    for (const ds of [-0.02, 0.02]) for (const di of [-0.3, 0.3])
      expect(sse(m.slope + ds, m.intercept + di)).toBeGreaterThanOrEqual(best - 1e-9);
  });
});

describe('skew widens the search window — why one model isn’t enough', () => {
  it('clustered keys have a larger error bound than uniform ones', () => {
    const n = 40;
    const uniform = Array.from({ length: n }, (_, i) => i);              // straight CDF
    // most keys packed low, a few large outliers → a bent CDF a line can’t follow
    const clustered = Array.from({ length: n }, (_, i) => (i < n - 4 ? i : 500 + i * 50));
    expect(searchWindow(clustered, fitLinear(clustered)))
      .toBeGreaterThan(searchWindow(uniform, fitLinear(uniform)));
  });
});

describe('binary search cost', () => {
  it('is ceil(log2 n)', () => {
    expect(binarySearchCost(1024)).toBe(10);
    expect(binarySearchCost(1000)).toBe(10);
    expect(binarySearchCost(1)).toBe(1);
  });
});
