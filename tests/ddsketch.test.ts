import { describe, it, expect } from 'vitest';
import { DDSketch, exactQuantile } from '../src/web/ddsketch';

// a seeded log-scale dataset (latency-like, spanning orders of magnitude)
function dataset(n: number, seed: number): number[] {
  let s = seed; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; };
  return Array.from({ length: n }, () => Math.exp(1 + 3 * rnd()) + rnd() * 5);
}

describe('the relative-error guarantee', () => {
  it('every quantile estimate is within α of the true value', () => {
    const alpha = 0.01;
    const data = dataset(100000, 12345);
    const sk = new DDSketch(alpha);
    for (const v of data) sk.add(v);
    for (const q of [0.01, 0.25, 0.5, 0.9, 0.95, 0.99, 0.999]) {
      const est = sk.quantile(q), tru = exactQuantile(data, q);
      expect(Math.abs(est - tru) / tru).toBeLessThanOrEqual(alpha + 1e-9);
    }
  });
  it('holds across 150 random datasets and accuracy targets', () => {
    let s = 7; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; };
    for (let t = 0; t < 150; t++) {
      const alpha = 0.01 + rnd() * 0.05;
      const n = 100 + Math.floor(rnd() * 2000);
      const d = Array.from({ length: n }, () => Math.exp(rnd() * 8) + 0.001);
      const k = new DDSketch(alpha);
      for (const v of d) k.add(v);
      for (const q of [0.1, 0.5, 0.9, 0.99]) {
        const e = k.quantile(q), tr = exactQuantile(d, q);
        expect(Math.abs(e - tr) / tr).toBeLessThanOrEqual(alpha + 1e-9);
      }
    }
  });
});

describe('memory is tiny and independent of count', () => {
  it('100k values fit in a few hundred buckets', () => {
    const sk = new DDSketch(0.01);
    for (const v of dataset(100000, 999)) sk.add(v);
    expect(sk.count).toBe(100000);
    expect(sk.size).toBeLessThan(400);   // buckets ≪ values
  });
  it('γ = (1+α)/(1-α) and bucket edges are a constant factor apart', () => {
    const sk = new DDSketch(0.1);
    expect(sk.gamma).toBeCloseTo(1.1 / 0.9, 9);
    // a value and that value × γ land in adjacent buckets
    expect(sk.key(100 * sk.gamma) - sk.key(100)).toBe(1);
  });
});

describe('sketches merge by adding bucket counts', () => {
  it('merging two half-sketches equals one sketch of all the data', () => {
    const alpha = 0.01;
    const data = dataset(80000, 42);
    const full = new DDSketch(alpha); for (const v of data) full.add(v);
    const a = new DDSketch(alpha), b = new DDSketch(alpha);
    for (const v of data.slice(0, 40000)) a.add(v);
    for (const v of data.slice(40000)) b.add(v);
    a.merge(b);
    expect(a.count).toBe(80000);
    for (const q of [0.5, 0.9, 0.99]) expect(a.quantile(q)).toBeCloseTo(full.quantile(q), 9);
  });
});

describe('edge cases', () => {
  it('ignores non-positive values and returns NaN when empty', () => {
    const sk = new DDSketch(0.01);
    expect(sk.quantile(0.5)).toBeNaN();
    sk.add(-5); sk.add(0);
    expect(sk.count).toBe(0);
    sk.add(42);
    expect(Math.abs(sk.quantile(0.5) - 42) / 42).toBeLessThanOrEqual(0.01 + 1e-9);
  });
});
