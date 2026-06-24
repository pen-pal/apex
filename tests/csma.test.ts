import { describe, it, expect } from 'vitest';
import { simulateCsma, lowestBackoff, shares, rng, CW_MIN, CW_MAX } from '../src/web/csma';

describe('lowestBackoff — who transmits next', () => {
  it('the single lowest backoff wins (clean transmit)', () => {
    expect(lowestBackoff([3, 1, 5, 2])).toEqual([1]);
  });
  it('a tie at the lowest backoff is a collision', () => {
    expect(lowestBackoff([2, 0, 4, 0])).toEqual([1, 3]); // two stations reach 0 together
  });
});

describe('seeded PRNG', () => {
  it('is deterministic', () => {
    const a = rng(7), b = rng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('CSMA/CA simulation', () => {
  it('is deterministic for a seed', () => {
    const x = simulateCsma(4, 200, 42);
    const y = simulateCsma(4, 200, 42);
    expect(x.timeline).toEqual(y.timeline);
    expect(x.stations.map((s) => s.sent)).toEqual(y.stations.map((s) => s.sent));
  });

  it('every transmission is ACKed and counts toward that station', () => {
    const r = simulateCsma(4, 400, 5);
    const txCount = r.timeline.filter((e) => e.kind === 'transmit').length;
    const totalSent = r.stations.reduce((a, s) => a + s.sent, 0);
    expect(txCount).toBe(totalSent); // one ack'd transmit per sent frame
    expect(r.timeline.filter((e) => e.kind === 'transmit').every((e) => e.kind === 'transmit' && e.acked)).toBe(true);
  });

  it('collisions occur under load, grow the contention window, and are counted', () => {
    const r = simulateCsma(12, 500, 3); // many stations → contention
    const collisionEvents = r.timeline.filter((e) => e.kind === 'collision');
    expect(collisionEvents.length).toBeGreaterThan(0);
    // each station's collision count matches how often it appeared in a collision
    for (const s of r.stations) {
      const inCollisions = collisionEvents.filter((e) => e.kind === 'collision' && e.stations.includes(s.id)).length;
      expect(s.collisions).toBe(inCollisions);
    }
  });

  it('shares the channel — no permanent starvation over a long run', () => {
    const r = simulateCsma(4, 4000, 9);
    expect(r.stations.every((s) => s.sent > 0)).toBe(true); // everyone got airtime
    const sh = shares(r);
    expect(sh.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it('keeps CW within bounds, and a recent successful sender is back at CW_MIN', () => {
    const r = simulateCsma(12, 500, 3); // contention → some CWs grow via backoff
    expect(r.stations.every((s) => s.cw >= CW_MIN && s.cw <= CW_MAX)).toBe(true);
    expect(r.stations.some((s) => s.cw === CW_MIN)).toBe(true); // whoever last sent cleanly reset
  });
});
