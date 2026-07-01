import { describe, it, expect } from 'vitest';
import { simulate, interleaved, bursty, sameLine, LINE } from '../src/web/falsesharing';

const packed = { offsetA: 0, offsetB: 8 };   // both in the first 64-byte line
const padded = { offsetA: 0, offsetB: LINE }; // B pushed to the next line

describe('cache-line layout', () => {
  it('detects whether two offsets share a 64-byte line', () => {
    expect(sameLine(packed)).toBe(true);
    expect(sameLine(padded)).toBe(false);
    expect(sameLine({ offsetA: 8, offsetB: 63 })).toBe(true);   // same line
    expect(sameLine({ offsetA: 63, offsetB: 64 })).toBe(false); // straddles a line boundary
  });
});

describe('false sharing under interleaved writes', () => {
  const seq = interleaved(1000);
  it('two counters on the SAME line bounce on every write and run ~25× slower', () => {
    const r = simulate(packed, seq);
    expect(r.sameLine).toBe(true);
    expect(r.transfers).toBe(1000);            // every write pulls the line to the other core
    expect(r.slowdown).toBeGreaterThan(20);
  });
  it('padding onto separate lines removes all coherence traffic', () => {
    const r = simulate(padded, seq);
    expect(r.transfers).toBe(0);
    expect(r.slowdown).toBe(1);
    expect(r.cycles).toBe(r.idealCycles);
  });
  it('padding makes it dramatically faster for the exact same work', () => {
    expect(simulate(packed, seq).cycles / simulate(padded, seq).cycles).toBeGreaterThan(20);
  });
});

describe('contention depends on the interleaving, not just the layout', () => {
  it('bursty access on a shared line bounces far less than lockstep access', () => {
    const burst = simulate(packed, bursty(1000, 50)); // each thread does 50 writes before yielding
    const lockstep = simulate(packed, interleaved(1000));
    expect(burst.transfers).toBeLessThan(lockstep.transfers);
    expect(burst.transfers).toBe(20);   // 1000/50 = 20 owner switches
    expect(burst.slowdown).toBeLessThan(lockstep.slowdown);
  });
  it('bursty on a PADDED layout is still contention-free', () => {
    expect(simulate(padded, bursty(1000, 50)).transfers).toBe(0);
  });
});
