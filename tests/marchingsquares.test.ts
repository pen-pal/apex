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

  it('resolves a saddle (case 10) by the center value so the connected region stays connected', () => {
    // corners tl=2, tr=0, br=2, bl=0 (above diagonal = tl,br). center=1.
    // threshold 0.9 → center ABOVE → tl,br connected through the center → isolate the below corners: pair T-R and B-L.
    const a = marchingSquares([[2, 0], [0, 2]], 0.9);
    expect(a).toHaveLength(2);
    expect(a[0]).toMatchObject({ x1: 0.55, y1: 0, x2: 1, y2: 0.45 });   // T-R
    expect(a[1]).toMatchObject({ x1: 0.45, y1: 1, x2: 0, y2: 0.55 });   // B-L
    // threshold 1.1 → center BELOW → the OTHER pairing: T-L and R-B
    const b = marchingSquares([[2, 0], [0, 2]], 1.1);
    expect(b[0]).toMatchObject({ x1: 0.45, y1: 0, x2: 0, y2: 0.45 });   // T-L
    expect(b[1]).toMatchObject({ x1: 1, y1: 0.55, x2: 0.55, y2: 1 });   // R-B
    // the two segments of a saddle must never cross each other
    const d = (p: number[], q: number[], r: number[]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const crosses = (s: typeof a[0], t: typeof a[0]) => {
      const [p1, p2, p3, p4] = [[s.x1, s.y1], [s.x2, s.y2], [t.x1, t.y1], [t.x2, t.y2]];
      return d(p3, p4, p1) > 0 !== d(p3, p4, p2) > 0 && d(p1, p2, p3) > 0 !== d(p1, p2, p4) > 0;
    };
    expect(crosses(a[0], a[1])).toBe(false);
    expect(crosses(b[0], b[1])).toBe(false);
  });

  it('a metaball field produces a contour around the blobs', () => {
    const f = metaballField(40, 30, [{ x: 14, y: 15, r: 6 }, { x: 26, y: 15, r: 6 }]);
    expect(marchingSquares(f, 1.0).length).toBeGreaterThan(10);
  });
});
