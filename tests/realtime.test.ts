import { describe, it, expect } from 'vitest';
import { deliver, sseReplay, maxDelay, type Ev } from '../src/web/realtime';

const events: Ev[] = [{ id: 1, readyMs: 0 }, { id: 2, readyMs: 30 }, { id: 3, readyMs: 200 }];
const o = { owdMs: 50, reconnectMs: 10 };

describe('open-connection transports (SSE, WebSocket) push in one hop', () => {
  for (const tp of ['sse', 'websocket'] as const) {
    it(`${tp}: every event is delivered at readyMs + owd`, () => {
      const d = deliver(tp, events, o);
      expect(d.map((x) => x.deliveredMs)).toEqual([50, 80, 250]);
      expect(maxDelay(d)).toBe(50); // constant one-hop latency
    });
  }
});

describe('long-poll pays a reconnect-gap penalty', () => {
  const d = deliver('longpoll', events, o);
  it('an event during an open poll is delivered in one hop, like the others', () => {
    expect(d[0]).toMatchObject({ id: 1, deliveredMs: 50, delayMs: 50 }); // poll was open at t=0
  });
  it('an event that fires during the reconnect gap waits for the next poll', () => {
    // after ev1: poll reopens at 50+50+10=110; ev2 (ready 30) must wait until 110, delivered 160
    expect(d[1]).toMatchObject({ id: 2, deliveredMs: 160 });
    expect(d[1].delayMs).toBe(130); // far worse than the 50ms one-hop latency
    expect(d[1].delayMs).toBeGreaterThan(o.owdMs);
  });
  it('its worst-case delay is much higher than the open-connection transports', () => {
    expect(maxDelay(d)).toBeGreaterThan(maxDelay(deliver('websocket', events, o)));
  });
});

describe('SSE Last-Event-ID replay', () => {
  it('after a reconnect, the server replays only events after the last one seen', () => {
    expect(sseReplay(events, 1).map((e) => e.id)).toEqual([2, 3]); // resume from id 1 → get 2,3
    expect(sseReplay(events, 3)).toEqual([]); // already up to date
  });
});
