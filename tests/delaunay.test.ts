import { describe, it, expect } from 'vitest';
import { circumcircle, inCircumcircle, triangulate, type Pt } from '../src/web/delaunay';

const P = (x: number, y: number): Pt => ({ x, y });
const isVertex = (t: { a: Pt; b: Pt; c: Pt }, p: Pt) => [t.a, t.b, t.c].some((v) => v.x === p.x && v.y === p.y);

describe('circumcircle', () => {
  it('is equidistant from all three vertices', () => {
    const c = circumcircle(P(0, 0), P(2, 0), P(0, 2));
    expect(c).toMatchObject({ x: 1, y: 1 });
    for (const v of [P(0, 0), P(2, 0), P(0, 2)]) expect((v.x - c.x) ** 2 + (v.y - c.y) ** 2).toBeCloseTo(c.r2, 9);
  });
  it('the in-circle test flags points inside and clears points outside', () => {
    const t = { a: P(0, 0), b: P(2, 0), c: P(0, 2) }; // circumcircle center (1,1) r²=2
    expect(inCircumcircle(t, P(1, 1))).toBe(true);   // dead center
    expect(inCircumcircle(t, P(5, 5))).toBe(false);  // far outside
  });
});

describe('triangulation', () => {
  it('a square becomes two triangles', () => {
    expect(triangulate([P(0, 0), P(10, 0), P(10, 10), P(0, 10)])).toHaveLength(2);
  });
  it('degenerate (<3 points) yields no triangles', () => {
    expect(triangulate([P(0, 0), P(1, 1)])).toHaveLength(0);
  });
});

describe('the Delaunay empty-circumcircle property, over 2000 random point sets', () => {
  it('no input point is ever strictly inside any triangle circumcircle (the defining property)', () => {
    // integer coords can be collinear/cocircular; that is fine for the empty-circle guarantee
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 2000; t++) {
      const n = 3 + rnd(25); const pts: Pt[] = []; const seen = new Set<string>();
      for (let i = 0; i < n; i++) { let x, y, k; do { x = rnd(200); y = rnd(200); k = `${x},${y}`; } while (seen.has(k)); seen.add(k); pts.push(P(x, y)); }
      for (const tri of triangulate(pts)) for (const p of pts) {
        if (isVertex(tri, p)) continue;
        expect(inCircumcircle(tri, p, 1e-6)).toBe(false);
      }
    }
  });

  it('in general position (random floats), every input point is a triangulation vertex', () => {
    let s = 3; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s / 0x80000000) * 200; };
    for (let t = 0; t < 500; t++) {
      const n = 4 + Math.floor(rnd() / 200 * 20);
      const pts: Pt[] = Array.from({ length: n }, () => P(rnd(), rnd())); // collinear/cocircular have probability 0
      const tris = triangulate(pts);
      const verts = new Set(tris.flatMap((tr) => [tr.a, tr.b, tr.c]).map((v) => `${v.x},${v.y}`));
      for (const p of pts) expect(verts.has(`${p.x},${p.y}`)).toBe(true);
    }
  });
});
