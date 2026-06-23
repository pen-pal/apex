// Error detection & correction — the real math behind "did these bytes survive
// the wire?". Every function here is genuine and cross-checked in tests against
// the engine's own primitives and against published check values.
//
// Refs: RFC 1071 (Internet checksum), IEEE 802.3 (CRC-32), Hamming (1950),
// ISO/IEC 7812 (Luhn). The "bytes are real" creed applies here too.

/** Even/odd parity bit for a byte: the single bit that makes the count of 1s even (or odd). */
export function parityBit(byte: number, odd = false): number {
  let ones = 0;
  for (let i = 0; i < 8; i++) ones += (byte >> i) & 1;
  const even = ones & 1; // 1 if an odd number of ones → need a 1 to make it even
  return odd ? even ^ 1 : even;
}

// ---- Internet checksum (RFC 1071), traced ----------------------------------

export interface CkStep {
  word: number; // the 16-bit word added
  runningSum: number; // sum after adding this word (before final fold)
}
export interface CkResult {
  steps: CkStep[];
  folded: number; // sum after end-around carry fold
  checksum: number; // one's complement of folded
}

/** One's-complement 16-bit sum with end-around carry, exposing each step. */
export function internetChecksum(bytes: number[]): CkResult {
  const steps: CkStep[] = [];
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    const word = (bytes[i] << 8) | (i + 1 < bytes.length ? bytes[i + 1] : 0);
    sum += word;
    steps.push({ word, runningSum: sum });
  }
  while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
  return { steps, folded: sum, checksum: (~sum) & 0xffff };
}

// ---- CRC as a shift register (LFSR), traced --------------------------------

/** A small CRC so the LFSR is watchable. CRC-8/ATM: poly 0x07, init 0x00. */
export const CRC8 = { poly: 0x07, width: 8 };

export interface CrcStep {
  inByte: number; // which source byte this clock belongs to
  clock: number; // 0..7 within that byte
  absorbed: number | null; // the byte XOR'd into the register at clock 0 (else null)
  before: number; // register before this clock
  popped: number; // the bit shifted out of the top
  xored: boolean; // did we XOR the polynomial this clock?
  after: number; // register after this clock
}
export interface CrcResult {
  steps: CrcStep[];
  remainder: number; // the final CRC (matches the published CRC-8 check value)
}

/**
 * CRC-8 as a shift register, MSB-first — the textbook formulation that matches
 * the published check value (0xF4 for "123456789", poly 0x07, init 0). Each
 * input byte is XOR'd into the register, then the register is clocked 8 times.
 */
export function crc8Trace(bytes: number[]): CrcResult {
  const { poly, width } = CRC8;
  const widthMask = (1 << width) - 1;
  const topMask = 1 << (width - 1);
  let reg = 0;
  const steps: CrcStep[] = [];
  for (let bi = 0; bi < bytes.length; bi++) {
    reg ^= bytes[bi]; // absorb the byte into the top of the register
    for (let clock = 0; clock < 8; clock++) {
      const before = reg;
      const popped = (reg & topMask) ? 1 : 0;
      let next = (reg << 1) & widthMask;
      const xored = popped === 1; // if the bit clocked out is 1, fold in the poly
      if (xored) next ^= poly;
      reg = next;
      steps.push({ inByte: bi, clock, absorbed: clock === 0 ? bytes[bi] : null, before, popped, xored, after: reg });
    }
  }
  return { steps, remainder: reg & widthMask };
}

// ---- Hamming(7,4): single-error CORRECTION ---------------------------------
// Bit positions 1..7 (1-indexed). Parity bits sit at powers of two (1,2,4);
// data bits fill the rest (3,5,6,7). Each parity bit covers the positions whose
// index has its bit set — that's what lets the syndrome point at the culprit.

export interface Hamming {
  data: number[]; // 4 data bits (d1..d4), MSB-first
  code: number[]; // 7 encoded bits, position 1..7
  parity: { p1: number; p2: number; p3: number };
}

/** Encode 4 data bits into a 7-bit Hamming codeword. */
export function hammingEncode(data: number[]): Hamming {
  const d = data.map((b) => (b ? 1 : 0));
  const [d1, d2, d3, d4] = d;
  const p1 = d1 ^ d2 ^ d4; // covers positions 1,3,5,7
  const p2 = d1 ^ d3 ^ d4; // covers positions 2,3,6,7
  const p3 = d2 ^ d3 ^ d4; // covers positions 4,5,6,7
  // position:   1   2   3   4   5   6   7
  const code = [p1, p2, d1, p3, d2, d3, d4];
  return { data: d, code, parity: { p1, p2, p3 } };
}

export interface HammingDecode {
  syndrome: number; // 0 = clean; otherwise the 1-indexed position of the flipped bit
  corrected: number[]; // the 7-bit codeword after correction
  data: number[]; // the recovered 4 data bits
  errorPos: number | null;
}

/** Decode a 7-bit codeword, locating and correcting any single-bit error. */
export function hammingDecode(code7: number[]): HammingDecode {
  const c = code7.map((b) => (b ? 1 : 0));
  // recompute parity over positions (1-indexed): syndrome bits s1,s2,s3
  const at = (pos: number) => c[pos - 1];
  const s1 = at(1) ^ at(3) ^ at(5) ^ at(7);
  const s2 = at(2) ^ at(3) ^ at(6) ^ at(7);
  const s3 = at(4) ^ at(5) ^ at(6) ^ at(7);
  const syndrome = (s3 << 2) | (s2 << 1) | s1; // points at the bad position
  const corrected = c.slice();
  let errorPos: number | null = null;
  if (syndrome !== 0 && syndrome <= 7) {
    corrected[syndrome - 1] ^= 1;
    errorPos = syndrome;
  }
  const data = [corrected[2], corrected[4], corrected[5], corrected[6]];
  return { syndrome, corrected, data, errorPos };
}

// ---- Luhn (the credit-card / IMEI check digit) -----------------------------

export interface LuhnResult {
  digits: number[];
  doubled: number[]; // each position's contribution after the Luhn doubling
  sum: number;
  valid: boolean;
}

/** Validate a number string with the Luhn algorithm (mod-10 check digit). */
export function luhn(input: string): LuhnResult | null {
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const ds = [...digits].map(Number);
  const doubled: number[] = [];
  let sum = 0;
  // double every second digit from the right
  for (let i = ds.length - 1, pos = 0; i >= 0; i--, pos++) {
    let v = ds[i];
    if (pos % 2 === 1) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    doubled[i] = v;
    sum += v;
  }
  return { digits: ds, doubled, sum, valid: sum % 10 === 0 };
}
