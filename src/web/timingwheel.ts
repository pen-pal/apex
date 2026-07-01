// Timing wheel — how systems that juggle huge numbers of timers (the Linux kernel, Kafka, Netty, Akka) schedule
// them in O(1) instead of O(log n). The naive way to manage timers is a min-heap keyed by expiry: insert and
// remove-min are O(log n), which hurts when you have millions of short-lived timers (every network connection
// wants a keepalive and a timeout). A timing wheel is a circular array of buckets, like the numbers on a clock
// face, plus a hand that advances one bucket per "tick." To schedule a timer that should fire in d ticks, you
// don't search or sort — you just drop it into the bucket the hand will reach in d ticks: bucket =
// (current + d) mod N. Every tick, the hand moves to the next bucket and fires whatever timers live there. That
// makes insert, cancel, and per-tick expiry all O(1). The catch is delays longer than one full revolution
// (d ≥ N): the "hashed" timing wheel handles them by also storing a ROUNDS counter — how many more full laps
// before this timer is due — and decrementing it each time the hand passes, firing only when it hits zero.
// (Hierarchical wheels instead cascade into coarser wheels — seconds → minutes → hours — like a mechanical
// clock's gears.) This models a single hashed wheel. Reference: Varghese & Lauck, "Hashed and Hierarchical
// Timing Wheels" (1987); the Kafka/Netty timer implementations.

export interface Timer { id: string; rounds: number; fireAt: number; delay: number }

export class TimingWheel {
  readonly n: number;      // number of buckets
  current = 0;             // the bucket the hand points at
  time = 0;                // absolute ticks elapsed
  slots: Timer[][];

  constructor(n: number) { this.n = n; this.slots = Array.from({ length: n }, () => []); }

  /** Schedule a timer to fire in `delay` ticks (>=1). Returns which bucket and how many rounds it needs. */
  add(id: string, delay: number): Timer {
    const d = Math.max(1, Math.floor(delay));
    const bucket = (this.current + d) % this.n;
    const rounds = Math.floor((d - 1) / this.n);   // extra full laps before it's due
    const t: Timer = { id, rounds, fireAt: this.time + d, delay: d };
    this.slots[bucket].push(t);
    return t;
  }

  /** Cancel a scheduled timer by id. O(bucket size) at most; O(1) amortized with a back-index in practice. */
  cancel(id: string): boolean {
    for (const bucket of this.slots) {
      const i = bucket.findIndex((t) => t.id === id);
      if (i >= 0) { bucket.splice(i, 1); return true; }
    }
    return false;
  }

  /** Advance the hand one tick; fire (and remove) the timers in the new bucket whose rounds have run out. */
  tick(): Timer[] {
    this.time++;
    this.current = (this.current + 1) % this.n;
    const fired: Timer[] = [];
    const keep: Timer[] = [];
    for (const t of this.slots[this.current]) {
      if (t.rounds === 0) fired.push(t);
      else { t.rounds--; keep.push(t); }
    }
    this.slots[this.current] = keep;
    return fired;
  }

  /** All pending timers, for inspection/rendering. */
  pending(): { bucket: number; timers: Timer[] }[] {
    return this.slots.map((timers, bucket) => ({ bucket, timers }));
  }
}
