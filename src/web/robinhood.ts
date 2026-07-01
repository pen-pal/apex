// Robin Hood hashing — an open-addressing hash table with one elegant tweak that dramatically improves the
// worst case. In plain linear probing, a key hashes to a "home" slot and, if it's taken, walks forward to the
// next empty one; the number of steps is its "probe distance." The problem is variance: some keys sit right at
// home (distance 0) while unlucky ones in a cluster probe far, so the WORST-case lookup is long even though the
// average is fine. Robin Hood adds a fairness rule during insertion: as you probe, compare your probe distance
// so far with the distance of the element already sitting in each slot. If that element is RICHER than you —
// closer to its own home than you are to yours — you evict it, take its slot, and carry the evicted element
// onward to find a new home. You "rob from the rich (low distance) to give to the poor (high distance)." The
// effect is that all probe distances get equalized: no key ends up much worse off than any other, so the
// maximum probe distance stays tiny (O(log n) w.h.p. instead of much larger) and lookups have low, predictable
// latency. It also enables a neat early-exit on lookups — if you've probed farther than the element currently in
// the slot, your key can't be here, because Robin Hood would have placed it earlier. This models insertion with
// the swap rule, backward-shift deletion, and the probe-distance distribution versus plain linear probing.
// Reference: Celis, "Robin Hood Hashing" (1986); used in Rust's old std HashMap, and many high-performance ones.

export interface Slot { key: string; home: number }

function hashKey(key: string, cap: number): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h >>> 0) % cap;
}

export class RobinHood {
  readonly cap: number;
  slots: (Slot | null)[];
  size = 0;

  constructor(cap: number) { this.cap = cap; this.slots = new Array(cap).fill(null); }

  private dist(slot: number, home: number): number { return (slot - home + this.cap) % this.cap; }

  /** Insert a key with the Robin Hood swap rule. No-op if already present; false if the table is full of new keys. */
  insert(key: string): boolean {
    if (this.lookup(key) >= 0) return true;                       // already present (set semantics), no swaps
    if (this.size >= this.cap) return false;                      // full, and this key is new
    let cur: Slot = { key, home: hashKey(key, this.cap) };
    let slot = cur.home, d = 0;
    for (;;) {                                                    // size < cap ⇒ an empty slot exists
      const occ = this.slots[slot];
      if (occ === null) { this.slots[slot] = cur; this.size++; return true; }
      const existingDist = this.dist(slot, occ.home);
      if (existingDist < d) { this.slots[slot] = cur; cur = occ; d = existingDist; } // rob the richer element
      slot = (slot + 1) % this.cap; d++;
    }
  }

  /** Look up a key; returns its slot index or -1. Exits early once we've out-probed the resident element. */
  lookup(key: string): number {
    let slot = hashKey(key, this.cap), d = 0;
    for (let steps = 0; steps < this.cap; steps++) {
      const occ = this.slots[slot];
      if (occ === null) return -1;
      if (occ.key === key) return slot;
      if (this.dist(slot, occ.home) < d) return -1;               // Robin Hood early termination
      slot = (slot + 1) % this.cap; d++;
    }
    return -1;
  }

  /** Delete a key using backward-shift: pull following displaced elements back toward home. */
  delete(key: string): boolean {
    const at = this.lookup(key);
    if (at < 0) return false;
    let i = at, next = (i + 1) % this.cap;
    while (this.slots[next] !== null && this.dist(next, this.slots[next]!.home) > 0) {
      this.slots[i] = this.slots[next]; i = next; next = (i + 1) % this.cap;
    }
    this.slots[i] = null; this.size--;
    return true;
  }

  /** Probe distance of every occupied slot, plus max/mean/variance. */
  probeStats(): { distances: number[]; max: number; mean: number; variance: number } {
    const distances: number[] = [];
    for (let i = 0; i < this.cap; i++) if (this.slots[i]) distances.push(this.dist(i, this.slots[i]!.home));
    const n = distances.length || 1;
    const mean = distances.reduce((a, b) => a + b, 0) / n;
    const variance = distances.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    return { distances, max: distances.length ? Math.max(...distances) : 0, mean, variance };
  }
}

/** Plain linear probing (no swaps) — for comparison. Returns each occupied slot's probe distance. */
export function plainLinearProbe(keys: string[], cap: number): { max: number; variance: number } {
  const slots: (Slot | null)[] = new Array(cap).fill(null);
  for (const key of keys) {
    if (keys.indexOf(key) >= cap) break;
    const home = hashKey(key, cap); let slot = home;
    while (slots[slot] !== null) { if (slots[slot]!.key === key) break; slot = (slot + 1) % cap; }
    if (slots[slot] === null) slots[slot] = { key, home };
  }
  const dists: number[] = [];
  for (let i = 0; i < cap; i++) if (slots[i]) dists.push((i - slots[i]!.home + cap) % cap);
  const n = dists.length || 1, mean = dists.reduce((a, b) => a + b, 0) / n;
  return { max: dists.length ? Math.max(...dists) : 0, variance: dists.reduce((a, b) => a + (b - mean) ** 2, 0) / n };
}
