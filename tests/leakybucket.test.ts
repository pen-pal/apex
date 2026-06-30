import { describe, it, expect } from 'vitest';
import { leakyBucket, totalDropped, totalOutput, peakOutput } from '../src/web/leakybucket';

describe('leaky bucket smooths bursts to a constant rate', () => {
  // capacity 5, leak 2; two bursts of 5 with idle gaps.
  const ticks = leakyBucket([5, 0, 0, 5, 0], 5, 2);

  it('admits a burst into the bucket then leaks it at the fixed rate', () => {
    expect(ticks.map((t) => t.output)).toEqual([2, 2, 1, 2, 2]); // never exceeds the leak rate of 2
    expect(ticks.map((t) => t.level)).toEqual([3, 1, 0, 3, 1]);
  });
  it('output never bursts above the leak rate', () => {
    expect(peakOutput(ticks)).toBe(2);
  });
  it('conserves packets: arrived = output + dropped + still-in-bucket', () => {
    const arrived = 10, leftover = ticks[ticks.length - 1].level;
    expect(arrived).toBe(totalOutput(ticks) + totalDropped(ticks) + leftover);
    expect(totalDropped(ticks)).toBe(0); // these bursts fit under capacity
  });
});

describe('overflow is dropped', () => {
  it('a burst larger than the spare capacity loses the excess', () => {
    const ticks = leakyBucket([8], 3, 1); // bucket holds 3, 8 arrive
    expect(ticks[0].admitted).toBe(3);
    expect(ticks[0].dropped).toBe(5);
    expect(ticks[0].output).toBe(1); // still leaks just 1
    expect(ticks[0].level).toBe(2);
  });
  it('a sustained overload drops down to exactly the leak rate of throughput', () => {
    const ticks = leakyBucket([10, 10, 10, 10], 4, 2);
    // long run: admit refills the leaked space (2) each tick after the first fill, so output ≈ leak rate
    expect(peakOutput(ticks)).toBe(2);
    expect(totalDropped(ticks)).toBeGreaterThan(0);
  });
});

describe('an under-rate stream passes through untouched', () => {
  it('arrivals at or below the leak rate are never dropped and pass straight through', () => {
    const ticks = leakyBucket([1, 2, 1, 2], 5, 2);
    expect(totalDropped(ticks)).toBe(0);
    expect(totalOutput(ticks)).toBe(6); // all 6 packets leave
    expect(ticks.every((t) => t.output <= 2)).toBe(true);
  });
});
