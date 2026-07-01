import { describe, it, expect } from 'vitest';
import { divergence, coalesce, patterns, WARP } from '../src/web/gpu';

describe('branch divergence in a warp', () => {
  it('a warp that all takes one path runs in a single pass at 100% efficiency', () => {
    expect(divergence(Array(WARP).fill(true))).toMatchObject({ passes: 1, efficiency: 1, diverged: false });
    expect(divergence(Array(WARP).fill(false))).toMatchObject({ passes: 1, efficiency: 1, diverged: false });
  });
  it('any divergence serializes both paths: 2 passes, and even one stray thread halves efficiency', () => {
    const half = Array.from({ length: WARP }, (_, i) => i < 16);
    expect(divergence(half)).toMatchObject({ passes: 2, efficiency: 0.5, diverged: true });
    const one = Array.from({ length: WARP }, (_, i) => i === 0);
    expect(divergence(one).passes).toBe(2);
    expect(divergence(one).efficiency).toBeCloseTo(0.5, 5); // 32 useful lane-ops over 2*32 issued
  });
  it('efficiency is useful-lane-ops / (passes * warp)', () => {
    const d = divergence(Array.from({ length: WARP }, (_, i) => i < 8)); // 8 if, 24 else
    expect(d.activePerPass).toEqual([8, 24]);
    expect(d.efficiency).toBeCloseTo((8 + 24) / (2 * WARP), 5);
  });
});

describe('memory coalescing', () => {
  it('contiguous accesses fuse into one transaction at full bandwidth', () => {
    const c = coalesce(patterns.contiguous(WARP)); // 32 x 4B = 128B = one 128B line
    expect(c.transactions).toBe(1);
    expect(c.efficiency).toBe(1);
  });
  it('scattered / large-stride accesses take one transaction per line and waste bandwidth', () => {
    const s = coalesce(patterns.strided(WARP, 32)); // each thread lands in its own line
    expect(s.transactions).toBe(WARP);
    expect(s.efficiency).toBeCloseTo(1 / WARP, 5);
    expect(coalesce(patterns.scattered(WARP)).transactions).toBeGreaterThan(1);
  });
  it('transactions equal the number of distinct cache lines touched', () => {
    const addrs = [0, 4, 8, 200, 204, 5000]; // lines 0,0,0,1,1,39 → 3 distinct
    expect(coalesce(addrs, 128).transactions).toBe(3);
  });
  it('efficiency = bytes used / bytes fetched, always in [0,1]', () => {
    for (const p of [patterns.contiguous(WARP), patterns.strided(WARP, 4), patterns.scattered(WARP)]) {
      const c = coalesce(p);
      expect(c.efficiency).toBeGreaterThanOrEqual(0);
      expect(c.efficiency).toBeLessThanOrEqual(1);
      expect(c.efficiency).toBeCloseTo(c.bytesUsed / c.bytesFetched, 5);
    }
  });
});
