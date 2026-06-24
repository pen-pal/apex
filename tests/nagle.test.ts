import { describe, it, expect } from 'vitest';
import { simulate, type NagleConfig } from '../src/web/nagle';

// All expected times are hand-computed from the timing rules (one-way delay = RTT/2),
// not read back from the implementation. RTT=100 → one-way 50ms throughout.
const base: NagleConfig = { writes: [50, 50], mss: 1460, rttMs: 100, nagle: true, delayedAck: true, delayedAckMs: 40 };
const sendAt = (r: ReturnType<typeof simulate>, seg: number) => r.events.find((e) => e.kind === 'send' && e.seg === seg)!.t;

describe('Nagle × delayed-ACK — the classic write-write-read stall', () => {
  it('Nagle ON + delayed-ACK ON deadlocks until the 40 ms timer fires', () => {
    // seg1 (50B) sent at t=0 (nothing in flight). seg2 (50B<MSS) is HELD because seg1 is
    // unacked. Receiver gets seg1 at 50, holds the ACK (no 2nd segment to piggyback on),
    // and only ACKs when its 40ms timer fires at 90. ACK reaches sender at 140 → Nagle
    // releases seg2 at 140. That ~140ms gap is the stall.
    const r = simulate(base);
    expect(r.segments).toBe(2);
    expect(sendAt(r, 1)).toBe(0);
    expect(sendAt(r, 2)).toBe(140); // held from t=0 until the delayed ACK arrives
    expect(r.stalledMs).toBe(140);
    expect(r.stalls).toEqual([{ from: 0, to: 140 }]); // held from t=0 until the ACK landed
    expect(r.completionMs).toBe(280); // seg2 delivered@190, its own delayed ACK@230, back@280
  });

  it('disabling Nagle (TCP_NODELAY) removes the stall — both small segments go at once', () => {
    const r = simulate({ ...base, nagle: false });
    expect(r.segments).toBe(2);
    expect(sendAt(r, 1)).toBe(0);
    expect(sendAt(r, 2)).toBe(0); // no holding — sent immediately
    expect(r.stalledMs).toBe(0);
    // both arrive at 50 → 2nd segment triggers an immediate ACK → back at 100 (one RTT)
    expect(r.completionMs).toBe(100);
  });

  it('disabling delayed ACK also avoids the timer — sender stalls only one RTT, not RTT+timer', () => {
    const r = simulate({ ...base, delayedAck: false });
    expect(r.segments).toBe(2);
    // seg1 ACKed immediately at 50, back at 100 → seg2 released at 100 (one RTT, no 40ms timer)
    expect(sendAt(r, 2)).toBe(100);
    expect(r.stalledMs).toBe(100);
    expect(r.completionMs).toBe(200);
  });
});

describe('Nagle coalescing (the tinygram problem it was designed to solve)', () => {
  it('five 1-byte telnet writes collapse into far fewer segments', () => {
    // RFC 896: without Nagle each keystroke is its own 41-byte packet (40B headers + 1B).
    // With Nagle, only the first goes out immediately; the rest are coalesced and released
    // together once the first is ACKed.
    const r = simulate({ ...base, writes: [1, 1, 1, 1, 1] });
    expect(r.bytes).toBe(5);
    expect(r.segments).toBe(2); // 1 byte out immediately, the other 4 coalesced into one segment
    expect(sendAt(r, 1)).toBe(0);
    expect(sendAt(r, 2)).toBe(140); // the coalesced 4 bytes ride out after the first is ACKed
  });

  it('a bulk send ships full-MSS segments immediately and only holds the sub-MSS tail', () => {
    // 4000B, MSS 1460: two full 1460B segments go out at t=0 (Nagle never holds full segments);
    // the trailing 1080B (<MSS) is the only thing held, until the first ACK arrives.
    const r = simulate({ ...base, writes: [4000] });
    expect(r.segments).toBe(3);
    expect(r.events.filter((e) => e.kind === 'send' && e.t === 0).map((e) => e.bytes)).toEqual([1460, 1460]);
    expect(sendAt(r, 3)).toBe(100); // tail released one RTT later (both full segments ACKed together at 50→back 100)
    expect(r.events.find((e) => e.kind === 'send' && e.seg === 3)!.bytes).toBe(1080);
    expect(r.completionMs).toBe(240); // tail delivered@150, delayed ACK@190, back@240
  });
});
