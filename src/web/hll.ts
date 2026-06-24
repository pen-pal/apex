// HyperLogLog (Flajolet et al., 2007) — estimate how many DISTINCT items a massive stream
// contains using a few kilobytes, no matter how many billions flow through. The intuition:
// hash each item to a random-looking bit string; the more distinct items you see, the more
// likely you are to have seen one with many leading zeros. Keep, per bucket, the largest
// "rank" (leftmost-1 position) observed; a register holding rank R hints ~2^R distinct
// items landed there. Averaging the m registers (harmonically) turns that hint into a
// cardinality estimate. Adding a duplicate never changes a register, so duplicates are
// free — that's what makes it count DISTINCT items. Pure; the deterministic core is tested.

export interface Hll { p: number; m: number; registers: number[] }

export function create(p: number): Hll {
  const m = 1 << p;
  return { p, m, registers: new Array(m).fill(0) };
}

/** 32-bit string hash (FNV-1a) followed by a Murmur fmix32 finalizer so every bit is
 *  well-avalanched — HyperLogLog relies on the rank bits being uniformly distributed. */
export function hash(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Split a 32-bit hash into its bucket (top p bits) and rank (position of the leftmost 1
 *  in the remaining bits, 1-indexed; all-zero → wBits+1). */
export function bucketAndRank(h: number, p: number): { bucket: number; rank: number } {
  h = h >>> 0;
  const bucket = h >>> (32 - p);
  const wBits = 32 - p;
  const mask = wBits >= 32 ? 0xffffffff : (1 << wBits) - 1;
  const w = (h & mask) >>> 0;
  let rank = wBits + 1;
  for (let i = wBits - 1; i >= 0; i--) if ((w >>> i) & 1) { rank = wBits - i; break; }
  return { bucket, rank };
}

export function add(hll: Hll, item: string): void {
  const { bucket, rank } = bucketAndRank(hash(item), hll.p);
  if (rank > hll.registers[bucket]) hll.registers[bucket] = rank; // keep the max
}

function alpha(m: number): number {
  if (m === 16) return 0.673;
  if (m === 32) return 0.697;
  if (m === 64) return 0.709;
  return 0.7213 / (1 + 1.079 / m);
}

/** The cardinality estimate, with small-range linear-counting correction. */
export function estimate(hll: Hll): number {
  const { m, registers } = hll;
  let sum = 0, zeros = 0;
  for (const r of registers) { sum += 2 ** -r; if (r === 0) zeros++; }
  let E = (alpha(m) * m * m) / sum;
  if (E <= 2.5 * m && zeros > 0) E = m * Math.log(m / zeros); // linear counting
  return E;
}

export const fromItems = (p: number, items: string[]): Hll => {
  const h = create(p);
  for (const x of items) add(h, x);
  return h;
};
