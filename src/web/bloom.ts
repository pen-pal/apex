// Bloom filter — a tiny probabilistic set that answers "have I seen this?" with
// "definitely not" or "possibly yes". An m-bit array and k hash functions: adding x
// sets the k bits hash_i(x); querying x checks those k bits. If ANY is 0, x was
// definitely never added (no false negatives, ever). If ALL are 1, x is *probably*
// present — but other items may have set those bits, so it can be a false positive.
// The FP probability rises as the array fills: ≈ (1 − e^(−kn/m))^k. Pure, tested.

/** k independent positions for `key` in an m-bit array (double hashing, Kirsch–Mitzenmacher). */
export function positions(key: string, m: number, k: number): number[] {
  // two base hashes (FNV-1a variants) combined into k indices
  let h1 = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h1 ^= key.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0; }
  let h2 = 0x9e3779b1 ^ key.length;
  for (let i = 0; i < key.length; i++) { h2 = Math.imul(h2 ^ key.charCodeAt(i), 0x85ebca77) >>> 0; }
  const out: number[] = [];
  for (let i = 0; i < k; i++) out.push(((h1 + Math.imul(i, h2)) >>> 0) % m);
  return out;
}

export type Verdict = 'definitely-not' | 'possibly';

export class BloomFilter {
  readonly m: number;
  readonly k: number;
  readonly bits: Uint8Array;
  private added = new Set<string>(); // kept only to MEASURE false positives, not used by query
  private count = 0;

  constructor(m: number, k: number) {
    this.m = Math.max(1, m);
    this.k = Math.max(1, k);
    this.bits = new Uint8Array(this.m);
  }

  get n(): number { return this.count; }
  get setBits(): number { let c = 0; for (const b of this.bits) if (b) c++; return c; }

  add(key: string): void {
    for (const p of positions(key, this.m, this.k)) this.bits[p] = 1;
    this.added.add(key);
    this.count++;
  }

  /** Membership test — never a false negative; "possibly" may be a false positive. */
  query(key: string): { verdict: Verdict; positions: number[]; allSet: boolean } {
    const ps = positions(key, this.m, this.k);
    const allSet = ps.every((p) => this.bits[p] === 1);
    return { verdict: allSet ? 'possibly' : 'definitely-not', positions: ps, allSet };
  }

  /** Was this key actually added? (Ground truth, for detecting false positives.) */
  wasAdded(key: string): boolean { return this.added.has(key); }

  /** Theoretical false-positive probability for the current load: (1 − e^(−kn/m))^k. */
  theoreticalFpRate(): number {
    return Math.pow(1 - Math.exp((-this.k * this.count) / this.m), this.k);
  }
}

/** Empirically measure the FP rate over a set of keys known NOT to be in the filter. */
export function measureFpRate(bf: BloomFilter, absentKeys: string[]): number {
  if (absentKeys.length === 0) return 0;
  let fp = 0;
  for (const key of absentKeys) if (bf.query(key).verdict === 'possibly') fp++;
  return fp / absentKeys.length;
}
