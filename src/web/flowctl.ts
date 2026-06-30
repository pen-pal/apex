// HTTP/2 & QUIC flow control — the TWO-level credit system that keeps a fast sender from drowning a
// receiver, per stream AND for the whole connection at once. A sender may transmit DATA only while it
// holds credit on BOTH the stream's window and the connection's window; each byte sent debits both.
// The receiver hands back credit as it consumes data (HTTP/2 WINDOW_UPDATE; QUIC MAX_STREAM_DATA for a
// stream, MAX_DATA for the connection). The subtlety the single-window TCP model can't show: a stream
// can hold plenty of its own credit yet still stall because the shared connection window is empty —
// so one greedy stream starves the others. Reference: RFC 9113 §5.2 (HTTP/2), RFC 9000 §4 (QUIC).

export interface Stream { id: number; window: number; sent: number }
export interface ConnState { connWindow: number; streams: Stream[] }
export type StallReason = 'stream' | 'connection' | null;
export interface SendResult { state: ConnState; sent: number; requested: number; stalled: StallReason }

const clone = (s: ConnState): ConnState => ({ connWindow: s.connWindow, streams: s.streams.map((x) => ({ ...x })) });

/** Send up to `bytes` on a stream, debiting both the stream window and the shared connection window.
 *  Returns how much actually went and — if short — which window was the binding constraint. */
export function send(state: ConnState, streamId: number, bytes: number): SendResult {
  const next = clone(state);
  const st = next.streams.find((s) => s.id === streamId);
  if (!st) return { state: next, sent: 0, requested: bytes, stalled: null };
  const allowed = Math.max(0, Math.min(bytes, st.window, next.connWindow));
  st.window -= allowed;
  st.sent += allowed;
  next.connWindow -= allowed;
  let stalled: StallReason = null;
  if (allowed < bytes) stalled = next.connWindow === 0 ? 'connection' : 'stream'; // connection wins if both are empty
  return { state: next, sent: allowed, requested: bytes, stalled };
}

/** A WINDOW_UPDATE / MAX_STREAM_DATA: grant `inc` more credit to one stream. */
export function streamUpdate(state: ConnState, streamId: number, inc: number): ConnState {
  const next = clone(state);
  const st = next.streams.find((s) => s.id === streamId);
  if (st) st.window += inc;
  return next;
}

/** A connection-level WINDOW_UPDATE / MAX_DATA: grant `inc` more credit to the whole connection. */
export function connUpdate(state: ConnState, inc: number): ConnState {
  const next = clone(state);
  next.connWindow += inc;
  return next;
}

/** True when a stream is blocked purely because the SHARED connection window is empty — the
 *  starvation case: it still has its own credit but cannot use it. */
export function starvedByConnection(state: ConnState, streamId: number): boolean {
  const st = state.streams.find((s) => s.id === streamId);
  return !!st && st.window > 0 && state.connWindow === 0;
}

export const initState = (connWindow: number, streams: { id: number; window: number }[]): ConnState =>
  ({ connWindow, streams: streams.map((s) => ({ id: s.id, window: s.window, sent: 0 })) });
