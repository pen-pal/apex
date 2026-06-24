// Hash tables and collision resolution — the everyday structure behind dictionaries, sets,
// and database indexes, and the two classic ways to handle the inevitable collisions when
// two keys hash to the same slot. SEPARATE CHAINING hangs a little list off each slot, so
// colliding keys coexist; lookups scan the chain. OPEN ADDRESSING (linear probing) keeps
// everything in the flat array and, on a collision, walks forward to the next free slot;
// lookups probe the same way. Chaining tolerates high load gracefully; probing is more
// cache-friendly but degrades sharply as the table fills (clustering). Pure, tested.

function hash(key: string, m: number): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0) % m;
}

// ── Separate chaining ──
export interface Chained { m: number; buckets: string[][] }
export const createChained = (m: number): Chained => ({ m, buckets: Array.from({ length: m }, () => []) });

export function chainInsert(t: Chained, key: string): { slot: number } {
  const slot = hash(key, t.m);
  if (!t.buckets[slot].includes(key)) t.buckets[slot].push(key);
  return { slot };
}
export function chainLookup(t: Chained, key: string): { slot: number; found: boolean; probes: number } {
  const slot = hash(key, t.m);
  const idx = t.buckets[slot].indexOf(key);
  return { slot, found: idx >= 0, probes: idx >= 0 ? idx + 1 : t.buckets[slot].length };
}

// ── Open addressing (linear probing) ──
export interface Probed { m: number; slots: (string | null)[] }
export const createProbed = (m: number): Probed => ({ m, slots: new Array(m).fill(null) });

export interface ProbeInsert { ok: boolean; slot: number; probeSeq: number[] }
export function probeInsert(t: Probed, key: string): ProbeInsert {
  const start = hash(key, t.m);
  const probeSeq: number[] = [];
  for (let i = 0; i < t.m; i++) {
    const s = (start + i) % t.m;
    probeSeq.push(s);
    if (t.slots[s] === null || t.slots[s] === key) { t.slots[s] = key; return { ok: true, slot: s, probeSeq }; }
  }
  return { ok: false, slot: -1, probeSeq }; // table full
}
export function probeLookup(t: Probed, key: string): { found: boolean; slot: number; probes: number } {
  const start = hash(key, t.m);
  for (let i = 0; i < t.m; i++) {
    const s = (start + i) % t.m;
    if (t.slots[s] === null) return { found: false, slot: -1, probes: i + 1 }; // empty → not present
    if (t.slots[s] === key) return { found: true, slot: s, probes: i + 1 };
  }
  return { found: false, slot: -1, probes: t.m };
}

export const loadFactor = (t: Probed): number => t.slots.filter((s) => s !== null).length / t.m;
export { hash as slotOf };
