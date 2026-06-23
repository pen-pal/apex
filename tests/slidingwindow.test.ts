import { describe, it, expect } from 'vitest';
import { windowView, send, ack, advertise, type WindowState } from '../src/web/slidingwindow';

const base: WindowState = { sndUna: 0, sndNxt: 0, rwnd: 16, cwnd: 32, total: 64 };

describe('windowView regions and usable window', () => {
  it('partitions the stream into acked / inFlight / sendable / blocked', () => {
    const v = windowView({ ...base, sndUna: 8, sndNxt: 12 });
    // send window = min(rwnd 16, cwnd 32) = 16; right edge = 8 + 16 = 24
    expect(v.sendWindow).toBe(16);
    expect(v.windowRight).toBe(24);
    expect(v.bytesInFlight).toBe(4); // 12 - 8
    expect(v.usableWindow).toBe(12); // 24 - 12
    expect(v.regions).toEqual({ acked: [0, 8], inFlight: [8, 12], sendable: [12, 24], blocked: [24, 64] });
  });

  it('clamps the window to the receiver when rwnd < cwnd (flow control binds)', () => {
    const v = windowView({ ...base, rwnd: 6, cwnd: 40, sndUna: 0, sndNxt: 0 });
    expect(v.sendWindow).toBe(6); // the slow receiver, not congestion, is the limit
    expect(v.usableWindow).toBe(6);
  });
});

describe('send is bounded by the usable window', () => {
  it('sends only up to the window, never beyond', () => {
    let s: WindowState = { ...base, rwnd: 10, cwnd: 32 };
    s = send(s, 100); // ask for 100, window allows 10
    expect(s.sndNxt).toBe(10);
    expect(windowView(s).usableWindow).toBe(0); // window now full
    s = send(s, 5); // nothing more can go out
    expect(s.sndNxt).toBe(10);
  });
});

describe('ack slides the window forward', () => {
  it('advancing the left edge frees up usable window', () => {
    let s: WindowState = { ...base, rwnd: 10, cwnd: 32, sndUna: 0, sndNxt: 10 }; // full
    expect(windowView(s).usableWindow).toBe(0);
    s = ack(s, 6); // 6 bytes acknowledged
    expect(s.sndUna).toBe(6);
    expect(windowView(s).usableWindow).toBe(6); // window slid → room for 6 more
  });
  it('never acks past what was sent', () => {
    const s = ack({ ...base, sndUna: 4, sndNxt: 8 }, 100);
    expect(s.sndUna).toBe(8); // capped at sndNxt
  });
});

describe('zero window (a stalled receiver) and persist', () => {
  it('a zero advertised window stops the sender entirely', () => {
    let s = advertise({ ...base, sndUna: 8, sndNxt: 8 }, 0);
    const v = windowView(s);
    expect(v.zeroWindow).toBe(true);
    expect(v.usableWindow).toBe(0);
    s = send(s, 20);
    expect(s.sndNxt).toBe(8); // nothing can be sent until a window update arrives
  });
  it('a window re-opening lets the sender resume (the persist-timer payoff)', () => {
    let s = advertise({ ...base, sndUna: 8, sndNxt: 8 }, 0);
    s = advertise(s, 12); // receiver drained its buffer and re-advertised
    expect(windowView(s).usableWindow).toBe(12);
    s = send(s, 12);
    expect(s.sndNxt).toBe(20);
  });
});
