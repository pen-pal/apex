// Vector clocks — how distributed systems reason about "what happened before what"
// when there is no shared clock. Each process keeps a vector (one counter per
// process). A local event bumps its own counter; a send bumps own then ships the
// vector; a receive merges the incoming vector (elementwise max) then bumps own.
// Comparing two vectors tells you the causal relation: one HAPPENED-BEFORE the
// other, or they are CONCURRENT (neither could have caused the other). Happened-
// before: Lamport 1978; the vector-clock construction itself: Fidge 1988 / Mattern
// 1988. Pure, deterministic model. Tested.

export type Clock = Record<string, number>;
export type Relation = 'equal' | 'before' | 'after' | 'concurrent';

export function emptyClock(procs: string[]): Clock {
  return Object.fromEntries(procs.map((p) => [p, 0]));
}

/** A local (internal) event at process p: bump p's own counter. */
export function localEvent(c: Clock, p: string): Clock {
  return { ...c, [p]: (c[p] ?? 0) + 1 };
}

/** Send from p: bump own, and the returned clock is also what's attached to the message. */
export function send(c: Clock, p: string): Clock {
  return localEvent(c, p);
}

/** Receive at p of a message carrying `msg`: merge (elementwise max) then bump own. */
export function receive(c: Clock, msg: Clock, p: string): Clock {
  const keys = new Set([...Object.keys(c), ...Object.keys(msg)]);
  const merged: Clock = {};
  for (const k of keys) merged[k] = Math.max(c[k] ?? 0, msg[k] ?? 0);
  merged[p] = (merged[p] ?? 0) + 1;
  return merged;
}

/** Causal relation between two vector clocks (the heart of it). */
export function compare(a: Clock, b: Clock): Relation {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aLessSomewhere = false, bLessSomewhere = false;
  for (const k of keys) {
    const av = a[k] ?? 0, bv = b[k] ?? 0;
    if (av < bv) aLessSomewhere = true;
    if (av > bv) bLessSomewhere = true;
  }
  if (!aLessSomewhere && !bLessSomewhere) return 'equal';
  if (aLessSomewhere && !bLessSomewhere) return 'before'; // a happened-before b
  if (bLessSomewhere && !aLessSomewhere) return 'after';
  return 'concurrent'; // each is ahead in some entry → no causal order
}

export function clockString(c: Clock, order: string[]): string {
  return '[' + order.map((p) => `${p}:${c[p] ?? 0}`).join(', ') + ']';
}
