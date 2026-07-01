// Hamming(7,4) — the first error-CORRECTING code (Richard Hamming, Bell Labs, 1950), born of frustration: the
// weekend batch computer would halt on a detected parity error and waste his whole run, so he asked whether the
// machine could not just detect but FIX the error and keep going. His answer encodes 4 data bits into a 7-bit
// codeword by adding 3 parity bits, placed at positions 1, 2, 4 — the powers of two. The magic is in that
// placement: parity bit at position 2^k checks exactly those positions whose index has bit k set. So position 5
// (binary 101) is covered by the parity bits at 1 and 4; position 6 (110) by 2 and 4; and so on. To decode, you
// recompute the three parity checks; read their pass/fail as a 3-bit number — the SYNDROME — and it is not just a
// yes/no, it is the BINARY INDEX of the flipped bit. Syndrome 000 means clean; 101 means "position 5 is wrong,"
// so you flip it back. One code corrects any single-bit error and needs only log-many parity bits (the (7,4),
// (15,11), (31,26)… family). Add one more overall-parity bit and you get SECDED — Single Error Correct, Double
// Error Detect — which is exactly what the ECC memory in servers uses on every read. This models encode, the
// syndrome, and correction. Reference: Hamming, "Error Detecting and Error Correcting Codes," BSTJ (1950).

// Positions are 1..7 (stored 0-indexed at p-1). Parity at 1,2,4; data at 3,5,6,7.
const DATA_POS = [3, 5, 6, 7];
const CHECKS = [
  { parity: 1, covers: [1, 3, 5, 7] }, // bit 0
  { parity: 2, covers: [2, 3, 6, 7] }, // bit 1
  { parity: 4, covers: [4, 5, 6, 7] }, // bit 2
];

/** Encode 4 data bits into a 7-bit Hamming codeword (positions 1..7). */
export function encode(data: number[]): number[] {
  const c = new Array(7).fill(0);
  DATA_POS.forEach((p, i) => { c[p - 1] = data[i] & 1; });
  for (const { parity, covers } of CHECKS) {
    c[parity - 1] = covers.filter((p) => p !== parity).reduce((x, p) => x ^ c[p - 1], 0); // even parity over data it covers
  }
  return c;
}

/** The syndrome: recompute each parity check; the checks that fail form the binary index of the bad bit (0 = clean). */
export function syndrome(code: number[]): number {
  let s = 0;
  for (const { parity, covers } of CHECKS) {
    const fail = covers.reduce((x, p) => x ^ code[p - 1], 0); // XOR of all covered positions incl the parity bit
    if (fail) s += parity;
  }
  return s;
}

export interface Decoded { corrected: number[]; data: number[]; errorPos: number }
/** Decode: locate any single-bit error via the syndrome, flip it back, and extract the 4 data bits. */
export function decode(code: number[]): Decoded {
  const errorPos = syndrome(code);
  const corrected = code.slice();
  if (errorPos !== 0) corrected[errorPos - 1] ^= 1;
  const data = DATA_POS.map((p) => corrected[p - 1]);
  return { corrected, data, errorPos };
}

/** Which positions each parity bit covers (for the view). */
export const checkCover = CHECKS;
export const dataPositions = DATA_POS;
