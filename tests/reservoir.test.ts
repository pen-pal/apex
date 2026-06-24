import { describe, it, expect } from 'vitest';
import { sample, mulberry32 } from '../src/web/reservoir';

describe('reservoir mechanics', () => {
  it('keeps the whole stream when k ≥ n', () => {
    expect(sample([1, 2, 3], 5, () => 0).reservoir).toEqual([1, 2, 3]);
    expect(sample([1, 2, 3], 3, () => 0.99).reservoir).toEqual([1, 2, 3]); // nothing to replace past the fill
  });

  it('the first k items always seed the reservoir', () => {
    const r = sample([10, 20, 30, 40, 50], 3, () => 0.999); // rand high → never replace
    expect(r.reservoir).toEqual([10, 20, 30]);
    expect(r.steps.slice(0, 3).every((s) => s.kept && s.evicted === null)).toBe(true);
    expect(r.steps.slice(3).every((s) => !s.kept)).toBe(true);
  });

  it('a deterministic rand drives exactly which items replace which slots', () => {
    // k=2 over [a=1,b=2,c=3,d=4]; reservoir starts [1,2]
    // i=2 (c): rand→0 → j=floor(0*3)=0 <2 → evict slot 0 → [3,2]
    // i=3 (d): rand→0 → j=floor(0*4)=0 <2 → evict slot 0 → [4,2]
    const seq = [0, 0];
    let n = 0;
    const r = sample([1, 2, 3, 4], 2, () => seq[n++]);
    expect(r.reservoir).toEqual([4, 2]);
    expect(r.steps[2]).toEqual({ index: 2, value: 3, kept: true, evicted: 1 });
    expect(r.steps[3]).toEqual({ index: 3, value: 4, kept: true, evicted: 3 });
  });

  it('the reservoir always holds exactly min(k, seen) items', () => {
    const rand = mulberry32(7);
    const r = sample(Array.from({ length: 100 }, (_, i) => i), 10, rand);
    expect(r.reservoir.length).toBe(10);
    expect(new Set(r.reservoir).size).toBe(10); // distinct (the stream had distinct values)
  });
});

describe('uniformity (the statistical payoff)', () => {
  it('every item is selected ≈ k/n of the time over many trials', () => {
    const n = 20, k = 5, trials = 4000;
    const counts = new Array(n).fill(0);
    const rand = mulberry32(12345);
    for (let t = 0; t < trials; t++) {
      const r = sample(Array.from({ length: n }, (_, i) => i), k, rand);
      for (const v of r.reservoir) counts[v]++;
    }
    const expected = (k / n) * trials; // = 1000
    for (const c of counts) expect(Math.abs(c - expected) / expected).toBeLessThan(0.15); // within 15%
  });
});
