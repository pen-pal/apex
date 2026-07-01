// The seqlock (sequence lock) — a reader/writer synchronization trick for data that is read constantly but
// written rarely, where you refuse to make readers pay. The classic user is the kernel clock: gettimeofday() is
// called millions of times a second and must be fast and never block, but the time value is a multi-word struct
// (seconds + nanoseconds) updated by a timer interrupt. A plain lock would serialize every reader; a plain read
// risks a TORN read — seeing the seconds from before an update and the nanoseconds from after. A seqlock solves
// it with a single counter and no reader locking. The writer bumps a sequence counter to an ODD value before it
// starts writing and to the next EVEN value when it's done. A reader snapshots the counter, reads the data, then
// re-reads the counter: if it was odd (a write was in progress) or it changed (a write happened during the
// read), the reader saw a possibly-torn value and simply RETRIES from the top. Readers never block and never
// take a lock — they just occasionally loop — so reads are almost free, at the cost that a read racing a write
// does a little wasted work. The tradeoff is deliberately asymmetric: writers are (lightly) serialized among
// themselves and readers are optimistic. The catch is that the data must be safe to read while being written
// (no pointer chasing that could fault, hence its use for POD structs), and you need the right memory barriers so
// the counter checks aren't reordered around the data reads. This models the writer's odd/even protocol and the
// reader's snapshot-read-recheck, and EXHAUSTIVELY proves across every interleaving that the seqlock reader never
// accepts a torn value while a naive lockless reader sometimes does. Reference: Lameter, "Effective
// Synchronization on Linux/NUMA"; the Linux kernel seqlock_t / seqcount.

export interface State { seq: number; a: number; b: number } // invariant while consistent: a === b (same generation)
export interface Ev { actor: 'W' | 'R'; label: string }
interface WEv extends Ev { apply: (s: State) => State }
interface REv extends Ev { field: 'seq' | 'a' | 'b'; into: 's1' | 'ra' | 'rb' | 's2' }

/** Writer transaction: raise the data from generation g to g+1, bracketed by odd/even counter bumps. */
export function writerOps(g: number): WEv[] {
  return [
    { actor: 'W', label: 'seq++ (→odd)', apply: (s) => ({ ...s, seq: s.seq + 1 }) },
    { actor: 'W', label: `a = ${g + 1}`, apply: (s) => ({ ...s, a: g + 1 }) },
    { actor: 'W', label: `b = ${g + 1}`, apply: (s) => ({ ...s, b: g + 1 }) },
    { actor: 'W', label: 'seq++ (→even)', apply: (s) => ({ ...s, seq: s.seq + 1 }) },
  ];
}
export const readerOps = (): REv[] => [
  { actor: 'R', label: 'read seq → s1', field: 'seq', into: 's1' },
  { actor: 'R', label: 'read a → ra', field: 'a', into: 'ra' },
  { actor: 'R', label: 'read b → rb', field: 'b', into: 'rb' },
  { actor: 'R', label: 'read seq → s2', field: 'seq', into: 's2' },
];

export interface Regs { s1: number; ra: number; rb: number; s2: number }
export type Outcome = { kind: 'ok'; a: number; b: number } | { kind: 'torn'; a: number; b: number } | { kind: 'retry' };

/** Execute one interleaving of the writer and reader ops over an initial state; capture the reader's registers. */
export function execute(order: Ev[], init: State): { regs: Regs; final: State } {
  let s = { ...init };
  const regs: Regs = { s1: 0, ra: 0, rb: 0, s2: 0 };
  for (const ev of order) {
    if (ev.actor === 'W') s = (ev as WEv).apply(s);
    else { const r = ev as REv; regs[r.into] = s[r.field]; }
  }
  return { regs, final: s };
}

/** The seqlock reader accepts only if the counter was even and unchanged; otherwise it retries. */
export function seqlockOutcome(r: Regs): Outcome {
  if (r.s1 % 2 === 1) return { kind: 'retry' };   // a write was already in progress
  if (r.s1 !== r.s2) return { kind: 'retry' };    // a write happened during the read
  return { kind: 'ok', a: r.ra, b: r.rb };        // even + unchanged ⇒ consistent snapshot
}

/** A naive lockless reader takes whatever it read — torn if the two fields disagree. */
export function naiveOutcome(r: Regs): Outcome {
  return r.ra === r.rb ? { kind: 'ok', a: r.ra, b: r.rb } : { kind: 'torn', a: r.ra, b: r.rb };
}

/** All order-preserving interleavings (merges) of two op lists. */
export function interleavings(w: Ev[], r: Ev[]): Ev[][] {
  if (w.length === 0) return [r.slice()];
  if (r.length === 0) return [w.slice()];
  return [
    ...interleavings(w.slice(1), r).map((m) => [w[0], ...m]),
    ...interleavings(w, r.slice(1)).map((m) => [r[0], ...m]),
  ];
}
