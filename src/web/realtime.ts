// Realtime delivery: long-poll vs SSE vs WebSocket — three ways to push server events to a browser,
// and why the latency differs. WebSocket and SSE keep a connection OPEN, so a server event reaches the
// client in one network hop. Long-poll can't: the client makes a request, the server holds it until an
// event, replies, and the client must RE-REQUEST — and any event that fires during that reconnect gap
// waits for the next poll to open. We model each transport's server→client delivery time over an event
// stream (one-way delay = owd), exposing long-poll's reconnect-gap penalty. Pure timing model, tested.

export type Transport = 'longpoll' | 'sse' | 'websocket';

export interface Ev { id: number; readyMs: number } // a server event becomes available at readyMs
export interface Delivery { id: number; readyMs: number; deliveredMs: number; delayMs: number }

export interface RtOpts { owdMs: number; reconnectMs: number } // owd = one-way delay; reconnect = client re-request gap

/** Compute when each event is delivered to the client under a transport. */
export function deliver(transport: Transport, events: Ev[], o: RtOpts): Delivery[] {
  const evs = [...events].sort((a, b) => a.readyMs - b.readyMs);
  if (transport !== 'longpoll') {
    // open connection: the event is pushed the instant it's ready (one hop)
    return evs.map((e) => ({ id: e.id, readyMs: e.readyMs, deliveredMs: e.readyMs + o.owdMs, delayMs: o.owdMs }));
  }
  // long-poll: an event can only be answered while a poll is open; otherwise it waits for the next one
  let pollOpenAt = 0;
  return evs.map((e) => {
    const respondAt = Math.max(e.readyMs, pollOpenAt); // wait if we're between polls
    const deliveredMs = respondAt + o.owdMs;
    pollOpenAt = deliveredMs + o.owdMs + o.reconnectMs; // response reaches client → client re-requests → request arrives
    return { id: e.id, readyMs: e.readyMs, deliveredMs, delayMs: deliveredMs - e.readyMs };
  });
}

/** SSE reconnect with Last-Event-ID: after a drop the client resends the last id it saw, and the
 *  server replays everything AFTER it — no gap in the stream. (WebSocket has no built-in equivalent;
 *  the app must implement its own resume.) */
export function sseReplay(allEvents: Ev[], lastEventId: number): Ev[] {
  return allEvents.filter((e) => e.id > lastEventId);
}

export const maxDelay = (ds: Delivery[]): number => Math.max(0, ...ds.map((d) => d.delayMs));
