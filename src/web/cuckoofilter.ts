// Cuckoo filter — approximate set membership like a Bloom filter, but it supports DELETE (Bloom can't) and beats
// Bloom's space at low false-positive rates. It stores a short FINGERPRINT of each item in a cuckoo hash table where
// every item has two candidate buckets. The trick that makes it work is PARTIAL-KEY cuckoo hashing: a fingerprint's two
// buckets are i and i XOR hash(fingerprint), which is symmetric — so when a fingerprint is evicted you can move it to
// its other bucket knowing only the fingerprint, without ever storing (or having) the original key. Membership can false
// positive (two items sharing a fingerprint in the same bucket pair) but never false-negative on something inserted.

export const BUCKETS = 8;   // must be a power of two for the XOR trick
export const SLOTS = 4;     // fingerprints per bucket
const MAX_KICKS = 32;

export type Buckets = number[][]; // [bucket][slot] = fingerprint (a small nonzero int)

const hash = (s: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
};

export const fingerprint = (x: string): number => (hash(x + '#fp') & 0xff) || 1; // 1..255, never 0
export const bucket1 = (x: string): number => hash(x) & (BUCKETS - 1);
// The other candidate bucket for a fingerprint, from either of its buckets (self-inverse: alt(alt(i,f),f) === i).
export const altBucket = (i: number, f: number): number => (i ^ (hash('alt' + f) & (BUCKETS - 1))) & (BUCKETS - 1);

export const empty = (): Buckets => Array.from({ length: BUCKETS }, () => []);
const clone = (b: Buckets): Buckets => b.map((slot) => [...slot]);

export interface InsertResult { buckets: Buckets; ok: boolean; landed: number; kicks: number }

export function insert(b0: Buckets, x: string): InsertResult {
  const b = clone(b0);
  const f = fingerprint(x);
  const i1 = bucket1(x), i2 = altBucket(i1, f);
  if (b[i1].length < SLOTS) { b[i1].push(f); return { buckets: b, ok: true, landed: i1, kicks: 0 }; }
  if (b[i2].length < SLOTS) { b[i2].push(f); return { buckets: b, ok: true, landed: i2, kicks: 0 }; }
  // both full — evict along a chain, relocating each victim to its other bucket via the XOR trick.
  let i = i2, cur = f;
  for (let k = 1; k <= MAX_KICKS; k++) {
    const victim = b[i][0];       // deterministic slot choice keeps the visualization reproducible
    b[i][0] = cur;
    cur = victim;
    i = altBucket(i, cur);
    if (b[i].length < SLOTS) { b[i].push(cur); return { buckets: b, ok: true, landed: i, kicks: k }; }
  }
  return { buckets: b0, ok: false, landed: -1, kicks: MAX_KICKS }; // table effectively full
}

export function contains(b: Buckets, x: string): boolean {
  const f = fingerprint(x);
  const i1 = bucket1(x), i2 = altBucket(i1, f);
  return b[i1].includes(f) || b[i2].includes(f);
}

export function remove(b0: Buckets, x: string): { buckets: Buckets; removed: boolean } {
  const b = clone(b0);
  const f = fingerprint(x);
  for (const i of [bucket1(x), altBucket(bucket1(x), f)]) {
    const j = b[i].indexOf(f);
    if (j !== -1) { b[i].splice(j, 1); return { buckets: b, removed: true }; }
  }
  return { buckets: b0, removed: false };
}

export const load = (b: Buckets): number => b.reduce((n, s) => n + s.length, 0);
