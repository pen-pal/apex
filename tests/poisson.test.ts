import { describe, it, expect } from 'vitest';
import { poissonDisk, whiteNoise, type Pt } from '../src/web/poisson';

const minDist = (pts: Pt[]): number => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  return m;
};

describe('the minimum-distance guarantee (blue noise)', () => {
  it('every pair of samples is at least r apart, and all lie in the domain', () => {
    const pts = poissonDisk(200, 200, 12, 42);
    expect(pts.length).toBeGreaterThan(100);
    expect(minDist(pts)).toBeGreaterThanOrEqual(12 - 1e-9);
    expect(pts.every((p) => p.x >= 0 && p.x < 200 && p.y >= 0 && p.y < 200)).toBe(true);
  });

  it('holds across 300 runs of varied radius and domain size (never a too-close pair)', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 300; t++) {
      const r = 6 + rnd(20), w = 80 + rnd(120), h = 80 + rnd(120);
      const p = poissonDisk(w, h, r, t + 1);
      expect(minDist(p)).toBeGreaterThanOrEqual(r - 1e-6);
    }
  });

  it('is approximately MAXIMAL: almost no empty spot could fit another sample', () => {
    const r = 12, W = 200, H = 200;
    const pts = poissonDisk(W, H, r, 7);
    let gaps = 0, tested = 0;
    for (let gx = 0; gx < W; gx += 4) for (let gy = 0; gy < H; gy += 4) {
      tested++;
      if (!pts.some((p) => Math.hypot(p.x - gx, p.y - gy) < r)) gaps++;
    }
    expect(gaps / tested).toBeLessThan(0.02); // <2% uncovered (only boundary edge effects)
  });
});

describe('contrast with white noise, and determinism', () => {
  it('uniform-random points at the same count clump far closer than r', () => {
    const pts = poissonDisk(200, 200, 12, 42);
    const wn = whiteNoise(200, 200, pts.length, 42);
    expect(minDist(wn)).toBeLessThan(12); // white noise violates the spacing badly
  });
  it('is deterministic for a given seed', () => {
    expect(poissonDisk(150, 150, 10, 99)).toEqual(poissonDisk(150, 150, 10, 99)); // same seed → identical
    expect(poissonDisk(150, 150, 10, 99)).not.toEqual(poissonDisk(150, 150, 10, 100)); // different seed → different
  });
});
