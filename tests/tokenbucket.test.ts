import { describe, it, expect } from 'vitest';
import { simulateBucket, bucketStats } from '../src/web/tokenbucket';

describe('token bucket — burst then steady state', () => {
  // capacity 5, refill 1/tick, a constant load of 3 req/tick, starting full.
  const trace = simulateBucket({ capacity: 5, refill: 1, ticks: 8, arrivals: 3, initialTokens: 5 });
  it('allows an initial burst, then throttles to the refill rate', () => {
    expect(trace.map((x) => x.allowed)).toEqual([3, 3, 1, 1, 1, 1, 1, 1]);
    expect(trace.map((x) => x.rejected)).toEqual([0, 0, 2, 2, 2, 2, 2, 2]);
  });
  it('settles to allowing exactly R per tick once the bucket is empty', () => {
    const steady = trace.slice(3);
    expect(steady.every((x) => x.allowed === 1)).toBe(true); // = refill rate
  });
  it('never holds more than capacity tokens', () => {
    expect(trace.every((x) => x.tokensEnd <= 5 && x.tokensStart <= 5)).toBe(true);
  });
});

describe('an idle period refills the bucket for the next burst', () => {
  // start empty, no traffic for a while, then a burst of 5.
  const trace = simulateBucket({ capacity: 5, refill: 1, ticks: 6, arrivals: [0, 0, 0, 0, 5, 5], initialTokens: 0 });
  it('accumulates tokens up to capacity while idle', () => {
    expect(trace[3].tokensEnd).toBe(4); // refilled 1/tick over 4 idle ticks
  });
  it('lets a full burst through once the bucket is full, then limits to R', () => {
    expect(trace[4].allowed).toBe(5); // the whole burst — bucket was full
    expect(trace[4].rejected).toBe(0);
    expect(trace[5].allowed).toBe(1); // next tick only the refill is available
    expect(trace[5].rejected).toBe(4);
  });
});

describe('refill is capped at capacity (no overflow)', () => {
  it('a large refill never exceeds the bucket size', () => {
    const trace = simulateBucket({ capacity: 3, refill: 100, ticks: 3, arrivals: 0, initialTokens: 0 });
    expect(trace.every((x) => x.tokensEnd <= 3)).toBe(true);
    expect(trace[0].refilled).toBe(3); // only filled to capacity, not 100
  });
});

describe('bucketStats', () => {
  it('summarises the accept/reject totals', () => {
    const trace = simulateBucket({ capacity: 5, refill: 1, ticks: 8, arrivals: 3, initialTokens: 5 });
    const s = bucketStats(trace);
    expect(s.totalArrived).toBe(24);
    expect(s.totalAllowed).toBe(12); // 3+3 + 1×6
    expect(s.totalRejected).toBe(12);
    expect(s.acceptRate).toBeCloseTo(0.5, 5);
  });
});
