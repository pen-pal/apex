import { describe, it, expect } from 'vitest';
import { bresenham, trueY } from '../src/web/bresenham';

const coords = (px: { x: number; y: number }[]) => px.map((p) => `${p.x},${p.y}`);

describe('basic lines', () => {
  it('a shallow line makes the expected staircase', () => {
    expect(coords(bresenham(0, 0, 6, 3))).toEqual(['0,0', '1,0', '2,1', '3,1', '4,2', '5,2', '6,3']);
  });
  it('horizontal, vertical, and diagonal are exact', () => {
    expect(coords(bresenham(0, 5, 4, 5))).toEqual(['0,5', '1,5', '2,5', '3,5', '4,5']);
    expect(coords(bresenham(3, 0, 3, 3))).toEqual(['3,0', '3,1', '3,2', '3,3']);
    expect(coords(bresenham(0, 0, 4, 4))).toEqual(['0,0', '1,1', '2,2', '3,3', '4,4']);
  });
  it('hits both endpoints', () => {
    const p = bresenham(2, 1, 10, 7);
    expect(p[0]).toMatchObject({ x: 2, y: 1 });
    expect(p[p.length - 1]).toMatchObject({ x: 10, y: 7 });
  });
});

describe('correctness properties over 50000 random lines (all octants)', () => {
  // Check every property with plain JS and return the first violation (or null). Asserting once at the end instead
  // of ~100 expect() calls per line keeps all 50k cases but avoids millions of matcher invocations (which dominate
  // the runtime and were timing the suite out).
  const check = (x0: number, y0: number, x1: number, y1: number): string | null => {
    const px = bresenham(x0, y0, x1, y1);
    const line = `(${x0},${y0})->(${x1},${y1})`;
    if (px[0].x !== x0 || px[0].y !== y0) return `${line}: start is ${px[0].x},${px[0].y}`;
    const end = px[px.length - 1];
    if (end.x !== x1 || end.y !== y1) return `${line}: end is ${end.x},${end.y}`;
    for (let i = 1; i < px.length; i++) // 8-connected: no gaps
      if (Math.abs(px[i].x - px[i - 1].x) > 1 || Math.abs(px[i].y - px[i - 1].y) > 1) return `${line}: gap at index ${i}`;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    if (dx >= dy && dx > 0) { // shallow: one pixel per x, y within half a cell of the real line
      if (new Set(px.map((p) => p.x)).size !== dx + 1) return `${line}: not one pixel per column`;
      for (const p of px) if (Math.abs(p.y - trueY(p.x, x0, y0, x1, y1)) > 0.5 + 1e-9) return `${line}: (${p.x},${p.y}) is off the true line`;
    }
    return null;
  };

  it('endpoints exact, pixels closest to the true line, 8-connected, one per column when shallow', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    let firstFailure: string | null = null;
    for (let t = 0; t < 50000 && firstFailure === null; t++) {
      firstFailure = check(rnd(40) - 20, rnd(40) - 20, rnd(40) - 20, rnd(40) - 20);
    }
    expect(firstFailure).toBeNull();
  });
});
