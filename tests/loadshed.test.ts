import { describe, it, expect } from 'vitest';
import { simulate } from '../src/web/loadshed';

// Sustained overload: 5 requests/tick offered, server handles 2/tick, clients wait 3 ticks.
const LOAD = Array(12).fill(5);
const CAP = 4, RATE = 2, DEADLINE = 3;

describe('bounded queue + shedding keeps latency and goodput stable', () => {
  const r = simulate(LOAD, CAP, RATE, DEADLINE, 'shed');
  it('the queue never exceeds capacity', () => {
    expect(r.maxQueue).toBeLessThanOrEqual(CAP);
  });
  it('accepted requests are served within their deadline (little or no wasted work)', () => {
    expect(r.wasted).toBe(0);
  });
  it('useful throughput stays near the service rate, and the excess is shed fast', () => {
    expect(r.goodput).toBeGreaterThan(RATE * (LOAD.length - 2)); // ~2/tick of good work
    expect(r.shed).toBeGreaterThan(0);
  });
});

describe('unbounded queue collapses under the same load', () => {
  const r = simulate(LOAD, CAP, RATE, DEADLINE, 'unbounded');
  it('the queue grows without bound (far past any capacity)', () => {
    expect(r.finalQueue).toBeGreaterThan(CAP * 3);
  });
  it('the server ends up wasting capacity on requests served too late (congestion collapse)', () => {
    expect(r.wasted).toBeGreaterThan(0);
    // by the end, latency is far above the deadline
    expect(r.ticks[r.ticks.length - 1].latency).toBeGreaterThan(DEADLINE);
  });
  it('sheds nothing — it accepts everything it cannot actually serve in time', () => {
    expect(r.shed).toBe(0);
  });
});

describe('shedding beats unbounded on useful work under overload', () => {
  it('more requests are served WITHIN deadline when shedding', () => {
    const shed = simulate(LOAD, CAP, RATE, DEADLINE, 'shed');
    const unb = simulate(LOAD, CAP, RATE, DEADLINE, 'unbounded');
    expect(shed.goodput).toBeGreaterThanOrEqual(unb.goodput);
  });
  it('under-rate load is fully served by both, with no shedding', () => {
    const light = [...Array(10).fill(1), 0, 0]; // 1/tick < rate 2, plus drain ticks
    const r = simulate(light, CAP, RATE, DEADLINE, 'shed');
    expect(r.shed).toBe(0);
    expect(r.goodput).toBe(10);  // all served once the queue drains
    expect(r.wasted).toBe(0);
  });
});
