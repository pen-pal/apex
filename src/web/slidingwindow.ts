// TCP sliding window — flow control (the receiver's advertised window, rwnd) and
// how it combines with congestion control (cwnd) to decide how much the sender may
// have outstanding. The sender's byte stream splits into four regions:
//   acked        — sent and acknowledged; the window has slid past these
//   inFlight     — sent but not yet acked (sent-unacked)
//   sendable     — within the window, may be sent right now
//   blocked      — beyond the window; must wait for the window to slide
// The send window = min(rwnd, cwnd); usable window = send window − bytesInFlight.
// Refs: RFC 9293 §3.8 (flow control), RFC 5681 (cwnd). Pure, tested.

export interface WindowState {
  sndUna: number; // first unacknowledged byte (left edge of the window)
  sndNxt: number; // next byte to send (boundary between inFlight and sendable)
  rwnd: number; // receiver advertised window
  cwnd: number; // congestion window
  total: number; // total bytes the app wants to send (stream length)
}

export interface WindowView {
  sendWindow: number; // min(rwnd, cwnd)
  windowRight: number; // sndUna + sendWindow (right edge)
  bytesInFlight: number; // sndNxt - sndUna
  usableWindow: number; // how many more bytes may be sent right now (>= 0)
  zeroWindow: boolean; // receiver has advertised rwnd = 0 (sender must stall)
  regions: { acked: [number, number]; inFlight: [number, number]; sendable: [number, number]; blocked: [number, number] };
}

/** Derive the four byte regions and the usable window from a window state. */
export function windowView(s: WindowState): WindowView {
  const sendWindow = Math.min(s.rwnd, s.cwnd);
  const windowRight = Math.min(s.sndUna + sendWindow, s.total);
  const bytesInFlight = s.sndNxt - s.sndUna;
  const usableWindow = Math.max(0, windowRight - s.sndNxt);
  return {
    sendWindow,
    windowRight,
    bytesInFlight,
    usableWindow,
    zeroWindow: s.rwnd === 0,
    regions: {
      acked: [0, s.sndUna],
      inFlight: [s.sndUna, s.sndNxt],
      sendable: [s.sndNxt, windowRight],
      blocked: [windowRight, s.total],
    },
  };
}

/** Send up to `n` bytes (bounded by the usable window): advances sndNxt. */
export function send(s: WindowState, n: number): WindowState {
  const usable = windowView(s).usableWindow;
  return { ...s, sndNxt: s.sndNxt + Math.min(n, usable) };
}

/** An ACK acknowledges up to `ackedBytes`, sliding the left edge forward. */
export function ack(s: WindowState, ackedBytes: number): WindowState {
  const sndUna = Math.min(s.sndUna + Math.max(0, ackedBytes), s.sndNxt);
  return { ...s, sndUna };
}

/** The receiver re-advertises a new window (e.g. its buffer filled or drained). */
export function advertise(s: WindowState, rwnd: number): WindowState {
  return { ...s, rwnd: Math.max(0, rwnd) };
}
