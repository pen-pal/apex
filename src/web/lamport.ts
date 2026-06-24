// Lamport logical clocks (Leslie Lamport, "Time, Clocks, and the Ordering of Events in
// a Distributed System", CACM 1978). With no shared physical clock, each process keeps
// a counter and follows three rules:
//   • before any event, increment your own counter;
//   • a message carries its sender's counter value;
//   • on receive, set counter = max(local, received) + 1.
// This guarantees the clock condition: if a happens-before b, then C(a) < C(b). The
// converse is NOT true — equal or ordered timestamps can belong to concurrent events —
// which is exactly the gap vector clocks close. A (timestamp, processId) pair gives a
// consistent TOTAL order. Pure and tested against a hand-worked space-time diagram.

export type Kind = 'local' | 'send' | 'recv';
export interface InputEvent { proc: number; kind: Kind; msg?: string; label?: string }
export interface StampedEvent extends InputEvent { idx: number; ts: number }

/** Assign Lamport timestamps by replaying the events in the given (causal) order. */
export function lamport(events: InputEvent[]): StampedEvent[] {
  const clocks: Record<number, number> = {};
  const msgTs: Record<string, number> = {};
  return events.map((e, idx) => {
    const c = clocks[e.proc] ?? 0;
    let ts: number;
    if (e.kind === 'recv') {
      const recvd = e.msg != null ? msgTs[e.msg] ?? 0 : 0;
      ts = Math.max(c, recvd) + 1;
    } else {
      ts = c + 1;
      if (e.kind === 'send' && e.msg != null) msgTs[e.msg] = ts;
    }
    clocks[e.proc] = ts;
    return { ...e, idx, ts };
  });
}

/** Lamport's consistent total order: by timestamp, ties broken by process id. */
export function totalOrder(stamped: StampedEvent[]): StampedEvent[] {
  return [...stamped].sort((a, b) => a.ts - b.ts || a.proc - b.proc);
}

/** Pair each send with its receive (matching msg), for drawing message arrows. */
export function messageArrows(stamped: StampedEvent[]): { from: StampedEvent; to: StampedEvent }[] {
  const sends = new Map<string, StampedEvent>();
  const arrows: { from: StampedEvent; to: StampedEvent }[] = [];
  for (const e of stamped) {
    if (e.kind === 'send' && e.msg != null) sends.set(e.msg, e);
    else if (e.kind === 'recv' && e.msg != null && sends.has(e.msg)) arrows.push({ from: sends.get(e.msg)!, to: e });
  }
  return arrows;
}
