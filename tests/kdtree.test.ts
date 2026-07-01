import { describe, it, expect } from 'vitest';
import { build, nearest, bruteNearest, type Point } from '../src/web/kdtree';

// deterministic pseudo-random points (no Math.random)
function points(n: number, seed = 42): Point[] {
  let s = seed; const r = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: n }, () => ({ x: Math.round(r() * 100), y: Math.round(r() * 100) }));
}

describe('nearest-neighbour correctness', () => {
  it('matches brute force on many random queries', () => {
    const pts = points(60);
    const root = build(pts);
    let s = 7; const r = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let t = 0; t < 300; t++) {
      const q = { x: Math.round(r() * 100), y: Math.round(r() * 100) };
      expect(nearest(root, q).dist).toBeCloseTo(bruteNearest(pts, q).dist, 9);
    }
  });
  it('a query exactly on a point returns distance 0', () => {
    const pts = points(30);
    const root = build(pts);
    for (const p of [pts[0], pts[15], pts[29]]) expect(nearest(root, p).dist).toBe(0);
  });
  it('handles tiny trees', () => {
    expect(nearest(build([{ x: 5, y: 5 }]), { x: 0, y: 0 }).dist).toBeCloseTo(Math.sqrt(50), 9);
    expect(nearest(build([]), { x: 0, y: 0 }).point).toBeNull();
    const two = build([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
    expect(nearest(two, { x: 1, y: 1 }).point).toEqual({ x: 0, y: 0 });
  });
});

describe('pruning makes it sub-linear', () => {
  it('a query visits far fewer nodes than the total point count', () => {
    const pts = points(200);
    const root = build(pts);
    let total = 0; let s = 99; const r = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let t = 0; t < 100; t++) total += nearest(root, { x: Math.round(r() * 100), y: Math.round(r() * 100) }).visited;
    const avg = total / 100;
    expect(avg).toBeLessThan(pts.length / 2); // typically ~log-ish, well under a full scan
  });
});

describe('the tree structure', () => {
  it('alternates split axis by depth and is balanced (median split)', () => {
    const root = build(points(15))!;
    expect(root.axis).toBe(0);            // root splits on x
    expect(root.left!.axis).toBe(1);      // children split on y
    expect(root.right!.axis).toBe(1);
    expect(root.left!.left!.axis).toBe(0);// grandchildren on x again
    // median split → left and right sizes differ by at most 1
    const size = (n: any): number => (n ? 1 + size(n.left) + size(n.right) : 0);
    expect(Math.abs(size(root.left) - size(root.right))).toBeLessThanOrEqual(1);
  });
});
