import { describe, it, expect } from 'vitest';
import { send, streamUpdate, connUpdate, starvedByConnection, initState } from '../src/web/flowctl';

// connection window 100; two streams with 60 credit each (so the two streams together can exceed
// the connection window — exactly the situation that exposes two-level flow control).
const start = () => initState(100, [{ id: 1, window: 60 }, { id: 2, window: 60 }]);

describe('two-level flow control debits both windows', () => {
  it('a send within both windows debits the stream and the connection equally', () => {
    const r = send(start(), 1, 60);
    expect(r.sent).toBe(60);
    expect(r.stalled).toBeNull();
    expect(r.state.connWindow).toBe(40);                 // 100 − 60
    expect(r.state.streams[0].window).toBe(0);           // stream 1 exhausted
  });

  it('a stream blocked by its OWN empty window reports a stream stall', () => {
    let s = send(start(), 1, 60).state;                  // stream 1 window → 0, conn → 40
    const r = send(s, 1, 10);
    expect(r.sent).toBe(0);
    expect(r.stalled).toBe('stream');
  });
});

describe('the connection window is the shared bottleneck', () => {
  it('a second stream is capped by the connection window, not its own', () => {
    let s = send(start(), 1, 60).state;                  // conn → 40
    const r = send(s, 2, 60);                             // wants 60, stream has 60, but conn only 40
    expect(r.sent).toBe(40);
    expect(r.state.connWindow).toBe(0);
    expect(r.state.streams[1].window).toBe(20);          // 20 stream credit left, but unusable
    expect(r.stalled).toBe('connection');
  });

  it('STARVATION: a stream with credit cannot send because the connection window is empty', () => {
    let s = send(start(), 1, 60).state;                  // conn → 40
    s = send(s, 2, 60).state;                             // conn → 0, stream 2 still has 20
    expect(starvedByConnection(s, 2)).toBe(true);
    const r = send(s, 2, 5);
    expect(r.sent).toBe(0);
    expect(r.stalled).toBe('connection');
  });

  it('a connection-level MAX_DATA unblocks the starved stream', () => {
    let s = send(start(), 1, 60).state;
    s = send(s, 2, 60).state;                             // conn → 0, stream 2 has 20
    s = connUpdate(s, 50);                                // MAX_DATA: conn → 50
    expect(starvedByConnection(s, 2)).toBe(false);
    const r = send(s, 2, 20);
    expect(r.sent).toBe(20);
    expect(r.state.connWindow).toBe(30);
    expect(r.state.streams[1].window).toBe(0);
  });
});

describe('window updates grant credit', () => {
  it('a stream WINDOW_UPDATE adds only to that stream', () => {
    const s = streamUpdate(start(), 1, 25);
    expect(s.streams[0].window).toBe(85);
    expect(s.streams[1].window).toBe(60);
    expect(s.connWindow).toBe(100);
  });
  it('total sent never exceeds the initial connection window without a MAX_DATA', () => {
    let s = start();
    for (const id of [1, 2, 1, 2]) s = send(s, id, 100).state; // hammer both streams
    const totalSent = s.streams.reduce((a, x) => a + x.sent, 0);
    expect(totalSent).toBe(100);                          // exactly the initial connection window
    expect(s.connWindow).toBe(0);
  });
});
