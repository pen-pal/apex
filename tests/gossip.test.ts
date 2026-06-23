import { describe, it, expect } from 'vitest';
import { gossip, rng } from '../src/web/gossip';

describe('seeded PRNG', () => {
  it('is deterministic and in [0,1)', () => {
    const a = rng(42), b = rng(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('gossip dissemination', () => {
  it('starts with exactly one informed node (the seed)', () => {
    const g = gossip(50, 3, 1);
    expect(g.rounds[0].count).toBe(1);
    expect(g.rounds[0].informed[0]).toBe(true);
  });

  it('the informed count is monotonic non-decreasing', () => {
    const g = gossip(64, 3, 7);
    for (let i = 1; i < g.rounds.length; i++) {
      expect(g.rounds[i].count).toBeGreaterThanOrEqual(g.rounds[i - 1].count);
    }
  });

  it('eventually informs every node (it converges)', () => {
    const g = gossip(80, 3, 5);
    expect(g.roundsToFull).toBeGreaterThan(0);
    expect(g.rounds[g.rounds.length - 1].count).toBe(80); // all informed
  });

  it('is deterministic for a given seed', () => {
    const a = gossip(64, 2, 99), b = gossip(64, 2, 99);
    expect(a.roundsToFull).toBe(b.roundsToFull);
    expect(a.rounds.map((r) => r.count)).toEqual(b.rounds.map((r) => r.count));
  });

  it('higher fanout converges in fewer (or equal) rounds', () => {
    const slow = gossip(128, 1, 3);
    const fast = gossip(128, 5, 3);
    expect(fast.roundsToFull).toBeGreaterThan(0);
    expect(fast.roundsToFull).toBeLessThan(slow.roundsToFull);
  });

  it('grows then saturates (an S-curve, not linear)', () => {
    const g = gossip(100, 3, 11);
    // early rounds add few, middle rounds add many, late rounds add few again
    const deltas = g.rounds.slice(1).map((r, i) => r.count - g.rounds[i].count);
    expect(Math.max(...deltas)).toBeGreaterThan(deltas[0]); // peak growth exceeds the first round
    expect(deltas[deltas.length - 1]).toBeLessThan(Math.max(...deltas)); // tails off at the end
  });
});
