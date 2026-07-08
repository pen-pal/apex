import { describe, it, expect } from 'vitest';
import { quantize } from '../src/web/quantize';

// Independent oracle: symmetric quantization. For b bits the signed range is [-(2^(b-1)), 2^(b-1)-1]; the scale is
// max|w| / (2^(b-1)-1), so the largest weight maps to the top level and every value rounds to the nearest multiple of
// the scale. Error per weight is at most half a step. An outlier raises max|w|, hence the scale/step, hence the error
// on the small weights. Memory is bits/16 of fp16. Expected numbers are computed by hand.

describe('symmetric quantization', () => {
  it('has 2^bits levels and memory bits/16 of fp16', () => {
    const q = quantize([1, 2, 3], 8);
    expect(q.levels).toBe(256);
    expect(q.memPct).toBe(50);           // int8 is half of fp16
    expect(quantize([1, 2, 3], 4).memPct).toBe(25);
  });
  it('the max-magnitude weight maps exactly (it defines the scale)', () => {
    const q = quantize([-0.5, 0.2, 4], 4); // qmax=7, scale=4/7
    expect(q.dequant[2]).toBeCloseTo(4, 10);
  });
  it('every weight is within half a step of its dequantized value', () => {
    const w = [-0.9, -0.3, 0.1, 0.55, 0.8, 0.05, -0.7];
    const q = quantize(w, 4);
    for (let i = 0; i < w.length; i++) expect(Math.abs(w[i] - q.dequant[i])).toBeLessThanOrEqual(q.step / 2 + 1e-9);
  });
  it('fewer bits → coarser step → larger error', () => {
    const w = [-0.9, -0.3, 0.1, 0.55, 0.8, 0.05, -0.7];
    expect(quantize(w, 3).rmse).toBeGreaterThan(quantize(w, 8).rmse);
  });
});

describe('the outlier problem', () => {
  const small = [-0.9, -0.3, 0.1, 0.55, 0.8, 0.05, -0.7];
  it('an outlier stretches the scale and worsens error on the small weights', () => {
    const withOutlier = [...small, 40]; // one huge weight
    const a = quantize(small, 4);
    const b = quantize(withOutlier, 4);
    expect(b.step).toBeGreaterThan(a.step);   // scale blown up by the outlier
    expect(b.rmse).toBeGreaterThan(a.rmse);   // small weights now land on coarse levels
  });
});
