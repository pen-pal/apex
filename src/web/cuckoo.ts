// Cuckoo hashing (Pagh & Rodler, 2001) — a hash table with O(1) WORST-CASE lookup, because
// every key lives in exactly one of two possible slots (given by two hash functions). The
// name comes from the cuckoo bird: on insert, if your slot is taken, you kick the current
// occupant out and re-home it in ITS other slot — which may displace another key, and so on,
// a chain of evictions. If the chain loops too long the table is full and must be resized
// (or re-hashed). It's the idea behind cuckoo FILTERS, which (unlike Bloom filters) support
// deletion. Deterministic hashes are injected so the eviction chains are reproducible.

export interface Cuckoo { m: number; table: (string | null)[]; seedA: number; seedB: number }

function h(key: string, seed: number, m: number): number {
  let x = seed >>> 0;
  for (let i = 0; i < key.length; i++) { x ^= key.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  x ^= x >>> 15;
  return (x >>> 0) % m;
}

export const create = (m = 11, seedA = 0x9e3779b1, seedB = 0x85ebca77): Cuckoo =>
  ({ m, table: new Array(m).fill(null), seedA, seedB });

export const slots = (c: Cuckoo, key: string): [number, number] => [h(key, c.seedA, c.m), h(key, c.seedB, c.m)];

export interface InsertResult { ok: boolean; evictions: { key: string; from: number; to: number }[] }

/** Insert a key, kicking out occupants along the way. On failure (a chain too long, or a
 *  key whose two hashes collide and has nowhere to go) the table is ROLLED BACK so no
 *  previously-stored key is ever lost and the failing key is not left behind. */
export function insert(c: Cuckoo, key: string, maxKicks = 16): InsertResult {
  const [s1, s2] = slots(c, key);
  if (c.table[s1] === key || c.table[s2] === key) return { ok: true, evictions: [] }; // already present
  if (c.table[s1] === null) { c.table[s1] = key; return { ok: true, evictions: [] }; }
  if (c.table[s2] === null) { c.table[s2] = key; return { ok: true, evictions: [] }; }

  const snapshot = [...c.table];                 // for rollback if the chain fails
  const evictions: InsertResult['evictions'] = [];
  let cur = key, pos = s1;
  for (let n = 0; n < maxKicks; n++) {
    if (c.table[pos] === null) { c.table[pos] = cur; return { ok: true, evictions }; }
    const displaced = c.table[pos]!;             // evict the occupant
    c.table[pos] = cur;
    const [a, b] = slots(c, displaced);
    const nextPos = a === pos ? b : a;           // its OTHER slot
    if (nextPos === pos) {                        // its two hashes collide → no alternate
      c.table = snapshot;                         // roll back: lose nothing
      return { ok: false, evictions: [] };
    }
    evictions.push({ key: displaced, from: pos, to: nextPos });
    cur = displaced;
    pos = nextPos;
  }
  c.table = snapshot;                             // chain too long → roll back, table unchanged
  return { ok: false, evictions: [] };
}

/** Lookup: at most two probes, ever. */
export function lookup(c: Cuckoo, key: string): { found: boolean; at: number | null; probes: number[] } {
  const [s1, s2] = slots(c, key);
  if (c.table[s1] === key) return { found: true, at: s1, probes: [s1] };
  if (c.table[s2] === key) return { found: true, at: s2, probes: [s1, s2] };
  return { found: false, at: null, probes: s1 === s2 ? [s1] : [s1, s2] };
}

export function remove(c: Cuckoo, key: string): boolean {
  const r = lookup(c, key);
  if (r.found && r.at !== null) { c.table[r.at] = null; return true; } // O(1) delete — Bloom can't
  return false;
}
