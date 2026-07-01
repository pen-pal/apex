import { describe, it, expect } from 'vitest';
import { HdrHist, quantize, relativeError } from '../src/web/hdrhist';

describe('quantize — constant relative error across magnitudes', () => {
  it('never rounds a value by more than a 1/S fraction', () => {
    const S = 8;
    for (let v = 1; v <= 50000; v++) {
      const q = quantize(v, S);
      expect(q).toBeLessThanOrEqual(v);
      expect((v - q) / v).toBeLessThanOrEqual(relativeError(S) + 1e-9);
    }
  });
  it('small values (< S range) are stored exactly', () => {
    for (let v = 0; v < 8; v++) expect(quantize(v, 8)).toBe(v);
  });
  it('the SAME relative resolution at tiny and huge magnitudes', () => {
    const S = 16;
    const errAt = (v: number) => (v - quantize(v, S)) / v;
    expect(errAt(100)).toBeLessThanOrEqual(relativeError(S) + 1e-9);
    expect(errAt(100000)).toBeLessThanOrEqual(relativeError(S) + 1e-9);
  });
  it('more sub-buckets → tighter error', () => {
    expect(relativeError(32)).toBeLessThan(relativeError(8));
  });
});

describe('HdrHist percentiles', () => {
  const S = 8;
  const h = new HdrHist(S);
  for (let v = 1; v <= 1000; v++) h.record(v); // uniform 1..1000

  it('recovers each percentile within the relative-error bound', () => {
    for (const [p, truth] of [[50, 500], [90, 900], [99, 990]] as const) {
      const got = h.percentile(p);
      expect(Math.abs(got - truth) / truth).toBeLessThanOrEqual(relativeError(S) + 0.02);
    }
  });
  it('p100 is the top occupied bucket', () => {
    expect(h.percentile(100)).toBe(quantize(1000, S));
  });
  it('an empty histogram returns 0', () => {
    expect(new HdrHist(8).percentile(99)).toBe(0);
  });
});

describe('bounded memory — the whole point', () => {
  it('records 100k distinct values into a tiny fixed set of buckets', () => {
    const h = new HdrHist(8);
    for (let v = 1; v <= 100000; v++) h.record(v);
    expect(h.count()).toBe(100000);
    expect(h.bucketCount()).toBeLessThan(200); // ~ octaves × S, NOT 100000
  });
  it('bucket count depends on the value RANGE, not the number of samples', () => {
    const a = new HdrHist(8), b = new HdrHist(8);
    for (let i = 0; i < 10; i++) a.record(1234);        // 10 samples, 1 value
    for (let i = 0; i < 100000; i++) b.record(1234);    // 100k samples, same value
    expect(a.bucketCount()).toBe(1);
    expect(b.bucketCount()).toBe(1);                     // count doesn't add buckets
  });
});
