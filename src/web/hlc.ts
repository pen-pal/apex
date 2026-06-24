// Hybrid Logical Clocks (Kulkarni et al., 2014) — timestamps that are BOTH close to real
// wall-clock time AND capture causality, in a constant 64-bit-ish package. A Lamport clock
// captures happens-before but drifts arbitrarily far from real time; a physical clock is
// real but can't order causally-related events when clocks are skewed or run backwards. An
// HLC is a pair (l, c): l tracks the largest physical time seen (so it stays near real
// time), and c is a small counter that breaks ties and absorbs backward clock jumps. The
// update rules guarantee: if event a happens-before b then HLC(a) < HLC(b) lexicographically,
// and l never trails the local physical clock by much. Used by CockroachDB and MongoDB for
// cross-node ordering without a global clock. Pure, tested against a hand-worked trace.

export interface Hlc { l: number; c: number }

export const compare = (a: Hlc, b: Hlc): number => a.l - b.l || a.c - b.c;

/** A local event (or send) at physical time `pt`: keep l near real time, bump c on a tie. */
export function localEvent(prev: Hlc, pt: number): Hlc {
  const l = Math.max(prev.l, pt);
  return { l, c: l === prev.l ? prev.c + 1 : 0 };
}

/** Receiving a message stamped `msg` at physical time `pt`. */
export function recvEvent(prev: Hlc, msg: Hlc, pt: number): Hlc {
  const l = Math.max(prev.l, msg.l, pt);
  let c: number;
  if (l === prev.l && l === msg.l) c = Math.max(prev.c, msg.c) + 1;
  else if (l === prev.l) c = prev.c + 1;
  else if (l === msg.l) c = msg.c + 1;
  else c = 0;
  return { l, c };
}

export type Event =
  | { kind: 'local'; pt: number; label: string }
  | { kind: 'send'; pt: number; label: string }
  | { kind: 'recv'; pt: number; msg: Hlc; label: string };

export interface Stamped { event: Event; hlc: Hlc; skew: number } // skew = l − pt (drift from real time)

/** Replay a sequence of events on one node, stamping each with its HLC. */
export function run(events: Event[], start: Hlc = { l: 0, c: 0 }): Stamped[] {
  let cur = start;
  return events.map((event) => {
    cur = event.kind === 'recv' ? recvEvent(cur, event.msg, event.pt) : localEvent(cur, event.pt);
    return { event, hlc: { ...cur }, skew: cur.l - event.pt };
  });
}

export const fmt = (h: Hlc): string => `${h.l}.${h.c}`;
