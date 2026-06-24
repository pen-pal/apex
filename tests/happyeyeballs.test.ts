import { describe, it, expect } from 'vitest';
import { race, ok, refused, timeout } from '../src/web/happyeyeballs';

describe('Happy Eyeballs race (attempt delay 250 ms)', () => {
  it('fast IPv6 wins outright — IPv4 is never even raced to completion', () => {
    const r = race(ok(20), ok(10)); // IPv6 connects at 20ms, before the 250ms IPv4 start
    expect(r.winner).toBe('IPv6');
    expect(r.connectMs).toBe(20);
    expect(r.ipv4StartMs).toBe(250);
    expect(r.ipv4ConnectMs).toBe(260); // would have connected later anyway
  });

  it('IPv6 preferred on a tie', () => {
    // IPv6 connects at 250; IPv4 starts at 250 and connects instantly (250) → tie → IPv6
    const r = race(ok(250), ok(0));
    expect(r.winner).toBe('IPv6');
    expect(r.connectMs).toBe(250);
  });

  it('a slow IPv6 path loses to the IPv4 fallback', () => {
    const r = race(ok(500), ok(10)); // IPv6 at 500ms; IPv4 starts 250, connects 260
    expect(r.winner).toBe('IPv4');
    expect(r.connectMs).toBe(260);    // far better than waiting 500ms for IPv6
  });

  it('a refused IPv6 bypasses the attempt delay — IPv4 starts immediately', () => {
    const r = race(refused(30), ok(10)); // IPv6 refused at 30ms → IPv4 starts at 30, connects 40
    expect(r.ipv4StartMs).toBe(30);   // did NOT wait the full 250ms
    expect(r.winner).toBe('IPv4');
    expect(r.connectMs).toBe(40);
  });

  it('a silently-timing-out IPv6 still lets IPv4 win after the delay', () => {
    const r = race(timeout(), ok(15)); // IPv6 never connects; IPv4 starts 250, connects 265
    expect(r.winner).toBe('IPv4');
    expect(r.connectMs).toBe(265);
  });

  it('both failing yields no connection', () => {
    expect(race(refused(20), refused(40)).winner).toBe(null);
  });
});

describe('the attempt delay is configurable', () => {
  it('a shorter delay races IPv4 sooner', () => {
    const fast = race(ok(300), ok(10), 100); // IPv4 starts at 100 → 110, beats IPv6 at 300
    expect(fast.winner).toBe('IPv4');
    expect(fast.connectMs).toBe(110);
  });
});
