// Stream watermarks — how a streaming engine (Flink, Beam, Kafka Streams) makes sense of events that
// arrive OUT OF ORDER and LATE. Every event carries an event-time (when it happened), but the network
// delivers them whenever. A WATERMARK is the engine's promise: "I've now seen everything up to time W."
// It's computed as (max event-time seen − allowed lateness): the lateness slack lets stragglers catch up.
// A time WINDOW (say [0,10)) fires its aggregate the moment the watermark passes its end — late enough to
// have collected the stragglers, but not waiting forever. An event that shows up after its window already
// fired is LATE and is dropped (or routed to a side output). This is the event-time-vs-processing-time
// distinction that makes streaming correct under real-world disorder. Reference: Akidau et al., "The
// Dataflow Model" (VLDB 2015); Apache Flink event-time docs.

export interface Ev { id: string; time: number }            // event-time, delivered in array (arrival) order
export interface Win { start: number; end: number; events: string[]; firedAt: number } // firedAt = watermark when it fired (Infinity = flushed at stream end)
export interface Step { id: string; time: number; watermark: number; windowStart: number; late: boolean; fired: number[] }
export interface Result { steps: Step[]; windows: Win[]; late: string[] }

const floorTo = (t: number, size: number) => Math.floor(t / size) * size;

/** Process `events` (in arrival order) into tumbling windows of `windowSize`, with `allowedLateness` slack
 *  on the watermark. Returns the per-arrival trace, the fired windows, and the events dropped as too-late. */
export function processStream(events: Ev[], windowSize: number, allowedLateness: number): Result {
  const pending = new Map<number, string[]>(); // windowStart -> on-time event ids, not yet fired
  const fired = new Set<number>();
  const windows: Win[] = [];
  const late: string[] = [];
  const steps: Step[] = [];
  let maxTime = -Infinity;

  const fireReady = (wm: number, firedNow: number[]) => {
    // fire every pending window whose end has been passed by the watermark, oldest first
    for (const ws of [...pending.keys()].sort((a, b) => a - b)) {
      if (ws + windowSize <= wm && !fired.has(ws)) {
        windows.push({ start: ws, end: ws + windowSize, events: pending.get(ws)!, firedAt: wm });
        fired.add(ws); pending.delete(ws); firedNow.push(ws);
      }
    }
  };

  for (const e of events) {
    const ws = floorTo(e.time, windowSize);
    const curWm = maxTime === -Infinity ? -Infinity : maxTime - allowedLateness; // watermark before this event
    // Late if the watermark has already passed this window's end — whether the window fired or was never
    // even created (an empty window that conceptually elapsed). The watermark is the single source of truth.
    const isLate = ws + windowSize <= curWm;
    const firedNow: number[] = [];
    if (isLate) {
      late.push(e.id);
    } else {
      if (!pending.has(ws)) pending.set(ws, []);
      pending.get(ws)!.push(e.id);
      maxTime = Math.max(maxTime, e.time);
      fireReady(maxTime - allowedLateness, firedNow);
    }
    steps.push({ id: e.id, time: e.time, watermark: maxTime === -Infinity ? -Infinity : maxTime - allowedLateness, windowStart: ws, late: isLate, fired: firedNow });
  }

  // End of stream: flush every remaining window (the watermark advances to +infinity).
  for (const ws of [...pending.keys()].sort((a, b) => a - b)) {
    windows.push({ start: ws, end: ws + windowSize, events: pending.get(ws)!, firedAt: Infinity });
    fired.add(ws);
  }
  return { steps, windows, late };
}
