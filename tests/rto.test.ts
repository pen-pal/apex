import { describe, it, expect } from 'vitest';
import { first, update, backoff, measure, MIN_RTO, MAX_RTO } from '../src/web/rto';

describe('RTO estimation (RFC 6298)', () => {
  it('first sample: SRTT=R, RTTVAR=R/2, raw RTO = 3R', () => {
    const s = first(100);
    expect(s.srtt).toBe(100);
    expect(s.rttvar).toBe(50);
    expect(s.rawRto).toBe(300); // 100 + 4*50
    expect(s.rto).toBe(MIN_RTO); // floored to 1s
  });

  it('subsequent update follows Jacobson/Karels', () => {
    const s = update(first(100), 200);
    expect(s.rttvar).toBe(62.5); // 0.75*50 + 0.25*|100-200|
    expect(s.srtt).toBe(112.5); // 0.875*100 + 0.125*200
    expect(s.rawRto).toBe(362.5); // 112.5 + 4*62.5
  });

  it('a steady RTT shrinks RTTVAR toward zero', () => {
    let s = first(100);
    for (let i = 0; i < 20; i++) s = update(s, 100);
    expect(s.srtt).toBeCloseTo(100, 1);
    expect(s.rttvar).toBeLessThan(1); // variation collapses on a stable path
  });
});

describe("Karn's algorithm", () => {
  it('a timeout doubles the RTO (exponential backoff), clamped', () => {
    const s = { srtt: 100, rttvar: 50, rawRto: 300, rto: 2000, samples: 3 };
    expect(backoff(s).rto).toBe(4000);
    expect(backoff({ ...s, rto: 40000 }).rto).toBe(MAX_RTO); // clamped at 60s
  });

  it('does NOT sample a retransmitted segment (ambiguous), it backs off instead', () => {
    const s = update(first(100), 120);
    const before = s.srtt;
    const after = measure(s, 999, true); // a wildly different RTT on a retransmit
    expect(after.srtt).toBe(before); // SRTT untouched — the sample was discarded
    expect(after.rto).toBe(Math.min(MAX_RTO, s.rto * 2)); // but the RTO backed off
  });

  it('measures a clean (non-retransmitted) segment normally', () => {
    const s = first(100);
    expect(measure(s, 200, false).srtt).toBe(update(s, 200).srtt);
  });
});
