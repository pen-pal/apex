import { describe, it, expect } from 'vitest';
import { simulateQueue, delayStats, totalDropped, type QueueConfig } from '../src/web/bufferbloat';

const big: QueueConfig = { ticks: 6, drain: 2, bufferSize: 100, arrivals: 4, mode: 'big-buffer' };

describe('basic queue mechanics', () => {
  it('an underloaded link keeps the queue (and delay) at zero', () => {
    const t = simulateQueue({ ticks: 5, drain: 4, bufferSize: 50, arrivals: 2, mode: 'big-buffer' });
    expect(t.every((x) => x.queueAfter === 0 && x.delay === 0 && x.dropped === 0)).toBe(true);
  });
  it('an overloaded link grows the queue by (arrivals − drain) each tick', () => {
    const t = simulateQueue(big);
    expect(t.map((x) => x.queueAfter)).toEqual([2, 4, 6, 8, 10, 12]); // +2 per tick
    expect(t.map((x) => x.delay)).toEqual([1, 2, 3, 4, 5, 6]); // bufferbloat: latency climbs
  });
});

describe('bufferbloat: a big buffer balloons latency', () => {
  it('delay rises monotonically and peaks high, with no early drops', () => {
    const t = simulateQueue(big);
    for (let i = 1; i < t.length; i++) expect(t[i].delay).toBeGreaterThan(t[i - 1].delay);
    expect(delayStats(t).peak).toBe(6);
    expect(totalDropped(t)).toBe(0); // the buffer just absorbs everything → high latency
  });
});

describe('AQM holds the standing delay near target', () => {
  const aqm: QueueConfig = { ...big, mode: 'aqm', aqmTargetDelay: 1 };
  it('keeps peak delay near the target instead of ballooning', () => {
    const t = simulateQueue(aqm);
    expect(delayStats(t).peak).toBeLessThanOrEqual(1); // vs 6 for the big buffer
  });
  it('trades drops for that low latency (throughput cost)', () => {
    const t = simulateQueue(aqm);
    expect(totalDropped(t)).toBeGreaterThan(0);
    expect(totalDropped(t)).toBeGreaterThan(totalDropped(simulateQueue(big))); // AQM drops more than big buffer
  });
  it('allows a single-tick transient burst before it starts dropping', () => {
    const t = simulateQueue(aqm);
    expect(t[0].dropped).toBe(0); // first burst is tolerated (CoDel interval)
  });
});

describe('tail drop on a full physical buffer', () => {
  it('drops overflow and caps the queue at the buffer size', () => {
    const t = simulateQueue({ ticks: 4, drain: 1, bufferSize: 3, arrivals: 5, mode: 'big-buffer' });
    expect(t.every((x) => x.queueAfter <= 3)).toBe(true);
    expect(totalDropped(t)).toBeGreaterThan(0); // a small buffer must drop the excess
  });
});
