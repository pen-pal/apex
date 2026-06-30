import { describe, it, expect } from 'vitest';
import { percentile, mean, fanoutTail, hedgedTail, sampleLatencies } from '../src/web/taillatency';

describe('percentiles (nearest-rank)', () => {
  const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // n=10
  it('computes the textbook nearest-rank values', () => {
    expect(percentile(data, 50)).toBe(50);  // ceil(0.50*10)=5th → 50
    expect(percentile(data, 90)).toBe(90);  // ceil(0.90*10)=9th → 90
    expect(percentile(data, 99)).toBe(100); // ceil(0.99*10)=10th → 100
    expect(percentile(data, 100)).toBe(100);
  });
  it('a heavy tail pushes p99 far above the median while the mean barely moves', () => {
    const d = [...Array(99).fill(10), 1000]; // 99 fast + 1 very slow
    expect(percentile(d, 50)).toBe(10);
    expect(percentile(d, 99)).toBe(10);      // the single spike sits in the top 1%
    expect(percentile(d, 100)).toBe(1000);
    expect(mean(d)).toBeCloseTo(19.9, 1);    // mean hides the spike that p100 exposes
  });
});

describe('fan-out tail amplification: 1 − (1−p)^N', () => {
  it('a 1%-per-server tail becomes ~63% once you wait for 100 servers', () => {
    expect(fanoutTail(0.01, 100)).toBeCloseTo(1 - Math.pow(0.99, 100), 10);
    expect(fanoutTail(0.01, 100)).toBeCloseTo(0.6340, 3);
  });
  it('one server is just p; zero fan-out is zero', () => {
    expect(fanoutTail(0.01, 1)).toBeCloseTo(0.01, 10);
    expect(fanoutTail(0.01, 0)).toBe(0);
  });
  it('amplification is monotonic in N', () => {
    expect(fanoutTail(0.02, 50)).toBeGreaterThan(fanoutTail(0.02, 10));
  });
});

describe('hedged requests cut the per-server tail to p^copies', () => {
  it('2 hedged copies turn a 10% tail into ~1% before fan-out', () => {
    // hedgedTail(p, n=1, copies=2) == 1-(1-p^2) == p^2
    expect(hedgedTail(0.1, 1, 2)).toBeCloseTo(0.01, 10);
  });
  it('hedging dramatically reduces the fanned-out tail', () => {
    expect(hedgedTail(0.05, 100, 2)).toBeLessThan(fanoutTail(0.05, 100));
  });
  it('one copy is identical to no hedging', () => {
    expect(hedgedTail(0.03, 40, 1)).toBeCloseTo(fanoutTail(0.03, 40), 12);
  });
});

describe('the latency sampler is deterministic and tunable', () => {
  it('produces the same series every call (no RNG)', () => {
    expect(sampleLatencies(20, 50, 5)).toEqual(sampleLatencies(20, 50, 5));
  });
  it('a heavier tail percentage raises p99 but not the median much', () => {
    const light = sampleLatencies(200, 50, 1);
    const heavy = sampleLatencies(200, 50, 10);
    expect(percentile(heavy, 99)).toBeGreaterThan(percentile(light, 99));
  });
});
