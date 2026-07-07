import { describe, it, expect } from 'vitest';
import { pearson, constantRatePad, links, bestMatch } from '../src/web/trafficcorr';

// Independent oracle: the Pearson correlation coefficient is a standard statistic with known properties — it is 1 for
// a series against itself (and against any positive affine transform of it), symmetric, bounded in [-1,1], and
// undefined (no shape to match) when a series is constant. Expected values are hand-computed or come from those
// properties, never from the implementation.

describe('pearson correlation', () => {
  it('a flow correlates perfectly with itself (r = 1)', () => {
    expect(pearson([3, 1, 4, 1, 5, 9, 2, 6], [3, 1, 4, 1, 5, 9, 2, 6])).toBeCloseTo(1, 12);
  });
  it('is invariant to a positive affine transform: r(x, 2x+3) = 1', () => {
    const x = [1, 2, 3, 4, 6];
    const y = x.map((v) => 2 * v + 3);
    expect(pearson(x, y)).toBeCloseTo(1, 12);
  });
  it('matches a hand-computed value: r([1,2,3],[1,3,2]) = 0.5', () => {
    expect(pearson([1, 2, 3], [1, 3, 2])).toBeCloseTo(0.5, 12);
  });
  it('a negated flow is perfectly anti-correlated (r = -1)', () => {
    expect(pearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 12);
  });
  it('is symmetric', () => {
    const a = [2, 5, 1, 8, 3], b = [1, 4, 0, 7, 2];
    expect(pearson(a, b)).toBeCloseTo(pearson(b, a), 12);
  });
  it('a constant (padded) series has no shape, so correlation is 0', () => {
    expect(pearson([5, 5, 5, 5], [1, 2, 3, 4])).toBe(0);
    expect(pearson([1, 2, 3, 4], [7, 7, 7, 7])).toBe(0);
  });
});

describe('constant-rate cover traffic defeats correlation (the defense)', () => {
  const target = [0, 8, 8, 0, 0, 6, 2, 0]; // a distinctive bursty flow

  it('the same flow observed at both ends is linked without a defense', () => {
    expect(links(target, target)).toBe(true);
  });
  it('padding to a flat rate erases the shape, so the flows no longer link', () => {
    const padded = constantRatePad(target);
    expect(new Set(padded).size).toBe(1);          // truly flat
    expect(padded[0]).toBe(8);                      // headroom = peak
    expect(links(padded, padded)).toBe(false);      // no variance ⇒ correlation 0 ⇒ below threshold
  });
});

describe('bestMatch: the adversary picks the most-correlated exit', () => {
  const entry = [0, 9, 9, 0, 0, 5, 1, 0];
  const decoy = [4, 4, 0, 7, 1, 0, 3, 6]; // an unrelated flow
  it('correctly fingers the matching exit among decoys', () => {
    const exits = [decoy, entry.slice(), decoy.map((v) => v + 1)];
    expect(bestMatch(entry, exits).index).toBe(1);
  });
  it('fails (index -1) when every candidate is padded flat', () => {
    const exits = [decoy, entry, decoy].map((f) => constantRatePad(f));
    expect(bestMatch(constantRatePad(entry), exits).index).toBe(-1);
  });
});
