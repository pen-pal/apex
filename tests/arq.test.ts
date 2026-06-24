import { describe, it, expect } from 'vitest';
import { simulate, wasted } from '../src/web/arq';

describe('Go-Back-N', () => {
  it('resends the lost frame and everything after it', () => {
    const r = simulate(6, 2, 'GBN');
    expect(r.total).toBe(6 + 4); // 6 first-pass + frames 2,3,4,5 resent
    expect(r.retransmits).toBe(4);
    expect(r.slots.filter((s) => s.pass === 2).map((s) => s.frame)).toEqual([2, 3, 4, 5]);
    expect(wasted(r)).toBe(3); // frames 3,4,5 were discarded by the receiver
  });

  it('losing the first frame resends the whole window', () => {
    const r = simulate(6, 0, 'GBN');
    expect(r.retransmits).toBe(6);
    expect(r.total).toBe(12);
  });
});

describe('Selective Repeat', () => {
  it('resends only the lost frame', () => {
    const r = simulate(6, 2, 'SR');
    expect(r.total).toBe(7); // 6 + just frame 2
    expect(r.retransmits).toBe(1);
    expect(r.slots.filter((s) => s.pass === 2).map((s) => s.frame)).toEqual([2]);
    expect(wasted(r)).toBe(0); // the receiver buffered, discarded nothing
    expect(r.slots.filter((s) => s.outcome === 'buffered')).toHaveLength(3); // frames 3,4,5
  });
});

describe('the two strategies diverge only when later frames exist', () => {
  it('losing the last frame costs the same (one resend) for both', () => {
    expect(simulate(6, 5, 'GBN').retransmits).toBe(1);
    expect(simulate(6, 5, 'SR').retransmits).toBe(1);
  });
  it('SR never sends more than GBN', () => {
    for (let n = 3; n <= 10; n++)
      for (let lost = 0; lost < n; lost++)
        expect(simulate(n, lost, 'SR').total).toBeLessThanOrEqual(simulate(n, lost, 'GBN').total);
  });
});
