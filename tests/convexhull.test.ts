import { describe, it, expect } from 'vitest';
import { cross, convexHull, inHull, type Pt } from '../src/web/convexhull';

const P = (x: number, y: number): Pt => ({ x, y });
const isConvex = (h: Pt[]) => h.every((_, i) => cross(h[i], h[(i + 1) % h.length], h[(i + 2) % h.length]) >= 0);

describe('the cross-product turn test', () => {
  it('signs a left turn +, a right turn −, and collinear 0', () => {
    expect(cross(P(0, 0), P(1, 0), P(1, 1))).toBeGreaterThan(0);  // CCW
    expect(cross(P(0, 0), P(1, 0), P(1, -1))).toBeLessThan(0);    // CW
    expect(cross(P(0, 0), P(1, 0), P(2, 0))).toBe(0);             // collinear
  });
});

describe('the hull itself', () => {
  it('a square with interior points hulls to its four corners (CCW)', () => {
    const h = convexHull([P(0, 0), P(4, 0), P(4, 4), P(0, 4), P(2, 2), P(1, 1), P(3, 2)]);
    expect(h).toEqual([P(0, 0), P(4, 0), P(4, 4), P(0, 4)]);
  });
  it('drops points that lie on an edge (minimal hull)', () => {
    expect(convexHull([P(0, 0), P(2, 0), P(4, 0), P(4, 4), P(0, 4)])).toHaveLength(4); // (2,0) dropped
  });
  it('handles degenerate inputs (≤2 unique points)', () => {
    expect(convexHull([P(1, 1)])).toEqual([P(1, 1)]);
    expect(convexHull([P(1, 1), P(1, 1), P(3, 3)])).toEqual([P(1, 1), P(3, 3)]); // dedupe
  });
});

describe('properties over 30000 random point sets', () => {
  it('the hull is convex, contains every input point, and its vertices are input points', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 30000; t++) {
      const n = 3 + rnd(30); const pts: Pt[] = [];
      for (let i = 0; i < n; i++) pts.push(P(rnd(50), rnd(50)));
      const h = convexHull(pts);
      if (h.length < 3) continue; // all collinear
      expect(isConvex(h)).toBe(true);
      expect(pts.every((p) => inHull(h, p))).toBe(true);
      expect(h.every((hp) => pts.some((p) => p.x === hp.x && p.y === hp.y))).toBe(true);
    }
  });
});
