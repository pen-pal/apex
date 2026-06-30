// MESI cache coherence — how N cores keep private caches of the SAME memory line consistent without
// ever reading stale data. Each core's copy of a line is in one of four states: Modified (dirty, sole
// owner), Exclusive (clean, sole owner), Shared (clean, maybe others have it), Invalid (don't have it).
// A core's own load/store plus the bus transactions it SNOOPS from other cores drive the transitions.
// The invariant that makes it correct: a line is in M or E in at most one cache at a time, and an M
// copy must be written back before anyone else reads it. Write-invalidate, write-back, snooping bus.
// Reference: Hennessy & Patterson, Computer Architecture (the MESI / snooping-coherence chapter);
// Papamarcos & Patel 1984. Transitions are enumerable and exactly testable (see tests).

export type State = 'M' | 'E' | 'S' | 'I';
export type Op = 'read' | 'write';
export type Bus = 'BusRd' | 'BusRdX' | 'BusUpgr' | null;

export interface Step {
  states: State[];   // per-core state AFTER the operation
  bus: Bus;          // bus transaction issued (null = satisfied locally, no bus traffic)
  flush: boolean;    // did a dirty (M) owner have to write back / supply the data?
  hit: boolean;      // was it a cache hit (no state change, no bus)?
  note: string;
}

export const STATE_NAME: Record<State, string> = { M: 'Modified', E: 'Exclusive', S: 'Shared', I: 'Invalid' };

/** Apply `op` by `core` to the shared line, returning the new states and the bus/flush effects. */
export function step(states: State[], core: number, op: Op): Step {
  const next = [...states];
  const others = states.map((_, i) => i).filter((i) => i !== core);
  const someoneElseHas = others.some((i) => states[i] !== 'I');
  const cur = states[core];

  if (op === 'read') {
    if (cur !== 'I') return { states: next, bus: null, flush: false, hit: true, note: `read hit in ${cur} — no bus traffic` };
    // read miss → BusRd. M/E owners drop to S (an M owner flushes); the reader becomes E if it is the
    // sole holder, otherwise S.
    const flush = others.some((i) => states[i] === 'M');
    for (const i of others) if (states[i] === 'M' || states[i] === 'E' || states[i] === 'S') next[i] = 'S';
    next[core] = someoneElseHas ? 'S' : 'E';
    return { states: next, bus: 'BusRd', flush, hit: false, note: someoneElseHas ? 'read miss — shared by others → S' : 'read miss — no other copy → E (exclusive)' };
  }

  // write
  if (cur === 'M') return { states: next, bus: null, flush: false, hit: true, note: 'write hit in M — no bus traffic' };
  if (cur === 'E') { next[core] = 'M'; return { states: next, bus: null, flush: false, hit: true, note: 'write hit — silent E→M upgrade (we already own it exclusively)' }; }
  if (cur === 'S') {
    for (const i of others) next[i] = 'I';
    next[core] = 'M';
    return { states: next, bus: 'BusUpgr', flush: false, hit: false, note: 'write to a Shared line → BusUpgr invalidates the other copies, then S→M' };
  }
  // cur === 'I' → write miss, read-for-ownership
  const flush = others.some((i) => states[i] === 'M');
  for (const i of others) next[i] = 'I';
  next[core] = 'M';
  return { states: next, bus: 'BusRdX', flush, hit: false, note: 'write miss → BusRdX fetches the line and invalidates every other copy, then →M' };
}

/** The coherence invariant: never two writers, and M/E is unique. Returns true iff `states` is legal. */
export function coherent(states: State[]): boolean {
  const owners = states.filter((s) => s === 'M' || s === 'E').length;
  if (owners > 1) return false;                       // at most one M or E copy
  if (owners === 1 && states.some((s) => s === 'S')) return false; // M/E excludes any S copy
  return true;
}
