import { describe, it, expect } from 'vitest';
import { normal, firstTfo, repeatTfo } from '../src/web/tfo';

const RTT = 100;

describe('TCP Fast Open round-trip cost', () => {
  it('normal TCP pays 2 RTT and sends no data until after the handshake', () => {
    const c = normal(RTT);
    expect(c.responseMs).toBe(200);
    expect(c.savedMs).toBe(0);
    expect(c.steps[0]).toMatchObject({ label: 'SYN', carriesData: false }); // SYN carries no data
  });

  it('the first TFO visit is a normal handshake but returns a cookie (no RTT saved yet)', () => {
    const c = firstTfo(RTT);
    expect(c.responseMs).toBe(200); // same as normal — you can't 0-RTT without a cookie
    expect(c.savedMs).toBe(0);
    expect(c.cookie).toBe(true);
    expect(c.steps.some((s) => s.label.includes('cookie'))).toBe(true);
  });

  it('a repeat TFO visit puts data in the SYN and saves a full RTT', () => {
    const c = repeatTfo(RTT, true);
    expect(c.responseMs).toBe(100); // one RTT instead of two
    expect(c.savedMs).toBe(100);
    expect(c.steps[0]).toMatchObject({ carriesData: true }); // request rides in the SYN
    expect(c.steps).toHaveLength(2); // SYN(+data) → SYN-ACK(+response); the handshake collapses
  });

  it('an invalid/stale cookie falls back to a normal handshake — no savings, no harm', () => {
    const c = repeatTfo(RTT, false);
    expect(c.responseMs).toBe(200); // back to 2 RTT
    expect(c.savedMs).toBe(0);
  });

  it('the saving is exactly one RTT regardless of latency', () => {
    for (const rtt of [20, 50, 250]) {
      expect(repeatTfo(rtt, true).savedMs).toBe(rtt);
      expect(normal(rtt).responseMs - repeatTfo(rtt, true).responseMs).toBe(rtt);
    }
  });
});
