import { describe, it, expect } from 'vitest';
import { marchingSquares, cellCase, metaballField } from '../src/web/marchingsquares';

describe('the per-cell case index', () => {
  it('reads the four corners as a 4-bit number (TL,TR,BR,BL); 0 and 15 emit nothing', () => {
    expect(cellCase(0, 0, 0, 0, 1)).toBe(0);
    expect(cellCase(2, 2, 2, 2, 1)).toBe(15);
    expect(cellCase(2, 0, 0, 0, 1)).toBe(8); // TL only
    expect(cellCase(2, 0, 2, 0, 1)).toBe(10); // TL+BR — a saddle
  });
});

describe('contour extraction', () => {
  it('a uniform cell (all above or all below) produces no contour', () => {
    expect(marchingSquares([[0, 0], [0, 0]], 1)).toHaveLength(0);
    expect(marchingSquares([[5, 5], [5, 5]], 1)).toHaveLength(0);
  });

  it('linear field x+y: every contour endpoint lies EXACTLY on x+y=threshold (interpolation is exact)', () => {
    const f = Array.from({ length: 10 }, (_, r) => Array.from({ length: 10 }, (_, c) => c + r));
    const segs = marchingSquares(f, 7);
    expect(segs.length).toBeGreaterThan(0);
    for (const s of segs) {
      expect(s.x1 + s.y1).toBeCloseTo(7, 9);
      expect(s.x2 + s.y2).toBeCloseTo(7, 9);
    }
  });

  it('a circular field yields a contour lying on the true circle', () => {
    const cx = 15, cy = 15, R = 10;
    const f = Array.from({ length: 30 }, (_, r) => Array.from({ length: 30 }, (_, c) => R * R - ((c - cx) ** 2 + (r - cy) ** 2)));
    const segs = marchingSquares(f, 0); // isoline at distance R
    expect(segs.length).toBeGreaterThan(20);
    for (const s of segs) {
      expect(Math.hypot(s.x1 - cx, s.y1 - cy)).toBeGreaterThan(9);
      expect(Math.hypot(s.x1 - cx, s.y1 - cy)).toBeLessThan(11); // within a cell of R=10
    }
  });

  it('a metaball field produces a contour around the blobs', () => {
    const f = metaballField(40, 30, [{ x: 14, y: 15, r: 6 }, { x: 26, y: 15, r: 6 }]);
    expect(marchingSquares(f, 1.0).length).toBeGreaterThan(10);
  });
});
