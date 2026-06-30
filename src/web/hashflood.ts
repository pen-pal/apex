// Hash flooding (algorithmic-complexity DoS) — how an attacker turns a hash table's O(1) into O(n) with
// nothing but carefully chosen keys. A hash table spreads keys across buckets; lookups and inserts are fast
// because each bucket holds ~1 item. But if the hash function is PREDICTABLE (e.g. key % numBuckets, or any
// unseeded hash an attacker can compute offline), the attacker crafts thousands of distinct keys that all
// land in the SAME bucket. Now every insert scans that growing chain — total work O(n²) — and a single HTTP
// request full of such keys (POST form fields, JSON keys, cache keys) pins a CPU. This was the 2011
// "hashDoS" that hit PHP, Python, Ruby, Java, .NET, Node all at once. The fix: a KEYED hash (SipHash) with a
// per-process random seed, so the attacker can't predict which bucket a key lands in. Reference: Crosby &
// Wallach (2003); Aumasson & Bernstein, SipHash (2012).

/** A predictable hash an attacker can compute offline: key mod numBuckets. */
export const weakHash = (key: number, buckets: number): number => ((key % buckets) + buckets) % buckets;

/** A keyed hash: mixing in a secret per-process seed makes the bucket unpredictable (stand-in for SipHash). */
export const seededHash = (key: number, buckets: number, seed: number): number => {
  let h = (key ^ seed) >>> 0;
  h = Math.imul(h, 2654435761) >>> 0; // Knuth multiplicative mix
  h = (h ^ (h >>> 15)) >>> 0;         // keep unsigned so the bucket index can't go negative
  return h % buckets;
};

/** Attacker's keys: multiples of `buckets` all collide in bucket 0 under weakHash (offline-computable). */
export const attackKeys = (n: number, buckets: number): number[] => Array.from({ length: n }, (_, i) => i * buckets);

export interface Cost { sizes: number[]; comparisons: number; maxBucket: number }

/** Insert `keys` into a chained hash table of `buckets`, hashing with `hash`. Each insert scans the existing
 *  chain (to dedup) then appends, so comparisons = Σ bucket-size-on-arrival. That sum is the attack surface:
 *  all-collide → 0+1+…+(n−1) = O(n²); well-spread → ~O(n). */
export function insertCost(keys: number[], buckets: number, hash: (k: number, b: number) => number): Cost {
  const sizes = new Array(buckets).fill(0);
  let comparisons = 0;
  for (const k of keys) {
    const b = hash(k, buckets);
    comparisons += sizes[b]; // walk the existing chain
    sizes[b]++;
  }
  return { sizes, comparisons, maxBucket: Math.max(...sizes, 0) };
}
