// Golomb–Rice coding — a variable-length integer code that's optimal when small values are common and big
// ones rare (a geometric distribution): audio/image residuals, the gaps between set bits, BIP158 block
// filters. Pick a parameter — here the Rice form, M = 2^k. To encode n, split it into a QUOTIENT q = ⌊n/M⌋
// and a REMAINDER r = n mod M. Write q in UNARY (q ones then a terminating 0) and r in k bits of BINARY.
// Small n → tiny quotient → tiny code; the code length is q + 1 + k bits, so the right k trades unary cost
// (big when values are large) against the fixed k remainder bits. Get k right and you're within a fraction
// of a bit of the entropy. Reference: Golomb (1966); Rice (1979); used in FLAC, JPEG-LS, BIP158.

/** Encode a non-negative integer as a Rice code with parameter k (M = 2^k). Returns a bit string. */
export function encode(n: number, k: number): string {
  if (n < 0 || !Number.isInteger(n)) throw new Error('encode expects a non-negative integer');
  const q = n >>> k;                       // quotient ⌊n / 2^k⌋
  const r = n & ((1 << k) - 1);            // remainder n mod 2^k (low k bits)
  const unary = '1'.repeat(q) + '0';       // q ones, then a 0 terminator
  const binary = k > 0 ? r.toString(2).padStart(k, '0') : '';
  return unary + binary;
}

/** Decode one Rice code with parameter k starting at `offset`; returns the value and bits consumed. */
export function decode(bits: string, k: number, offset = 0): { value: number; bitsRead: number } {
  let i = offset, q = 0;
  while (i < bits.length && bits[i] === '1') { q++; i++; }
  if (i >= bits.length) throw new Error('truncated unary (no terminating 0)');
  i++; // skip the terminating 0
  let r = 0;
  for (let b = 0; b < k; b++) { if (i >= bits.length) throw new Error('truncated remainder'); r = (r << 1) | (bits[i] === '1' ? 1 : 0); i++; }
  return { value: (q << k) + r, bitsRead: i - offset };
}

/** Bits a value costs at parameter k: q + 1 (unary) + k (remainder). */
export const codeLength = (n: number, k: number): number => (n >>> k) + 1 + k;

/** The k that minimizes total bits for a set of values (try a small range and pick the cheapest). */
export function bestK(values: number[], maxK = 16): { k: number; bits: number } {
  let best = { k: 0, bits: Infinity };
  for (let k = 0; k <= maxK; k++) {
    const bits = values.reduce((s, v) => s + codeLength(v, k), 0);
    if (bits < best.bits) best = { k, bits };
  }
  return best;
}
