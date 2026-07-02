import { describe, it, expect } from 'vitest';
import { Perlin } from '../src/web/perlin';

describe('gradient-noise hallmarks', () => {
  const p = new Perlin(42);
  it('is exactly 0 at every integer lattice point (the randomness lives BETWEEN grid points)', () => {
    // exactly zero in magnitude (grad·(0,0)=0); Math.abs also normalizes the −0 that a negative gradient produces
    for (let x = -20; x <= 20; x++) for (let y = -20; y <= 20; y++) expect(Math.abs(p.noise2d(x, y))).toBe(0);
  });
  it('stays within the ±√½ bound of 2-D unit-gradient noise', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s / 0x80000000) * n; };
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 300000; i++) { const v = p.noise2d(rnd(200) - 100, rnd(200) - 100); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    expect(lo).toBeGreaterThanOrEqual(-Math.SQRT1_2 - 1e-9);
    expect(hi).toBeLessThanOrEqual(Math.SQRT1_2 + 1e-9);
    expect(hi).toBeGreaterThan(0.5); // and it genuinely uses the range, not stuck near 0
  });
  it('is smooth: nearby points differ only slightly (unlike white noise)', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s / 0x80000000) * n; };
    let maxJump = 0;
    for (let i = 0; i < 100000; i++) { const x = rnd(100), y = rnd(100); maxJump = Math.max(maxJump, Math.abs(p.noise2d(x, y) - p.noise2d(x + 0.01, y))); }
    expect(maxJump).toBeLessThan(0.1); // a 0.01 step moves the value very little
  });
});

describe('determinism and the fade curve', () => {
  it('same seed reproduces, different seed diverges', () => {
    expect(new Perlin(42).noise2d(3.7, 8.2)).toBe(new Perlin(42).noise2d(3.7, 8.2));
    expect(new Perlin(42).noise2d(3.7, 8.2)).not.toBe(new Perlin(43).noise2d(3.7, 8.2));
  });
  it('the fade 6t⁵−15t⁴+10t³ pins (0,1) and is symmetric at ½', () => {
    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    expect(fade(0)).toBe(0);
    expect(fade(1)).toBe(1);
    expect(fade(0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('fractional Brownian motion (octaves)', () => {
  it('stays in ~[-1,1] and is deterministic', () => {
    const p = new Perlin(7);
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s / 0x80000000) * n; };
    for (let i = 0; i < 50000; i++) { const v = p.fbm(rnd(50), rnd(50), 5); expect(v).toBeGreaterThanOrEqual(-1); expect(v).toBeLessThanOrEqual(1); }
    expect(p.fbm(1.5, 2.5, 5)).toBe(new Perlin(7).fbm(1.5, 2.5, 5));
  });
});
