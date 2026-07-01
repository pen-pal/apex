// Elias γ and δ codes — self-delimiting, parameter-free ways to write a positive integer in binary so a decoder
// can tell where each number ENDS without any separator or fixed width. The problem: plain binary for 5 is
// "101", and for 21 is "10101" — but if you concatenate a stream of them, "10101" could be 21, or 5 then 1, or
// 2 then 5… you can't tell. Fixed 32-bit words solve it but waste space on small numbers, which dominate real
// data (gaps in a sorted posting list, small counts). Elias codes are UNIVERSAL: short for small numbers,
// growing gracefully for large ones, and each carries its own length. Gamma (γ): to encode n, write
// ⌊log2 n⌋ leading ZEROS, then n in binary (which always starts with 1). The zeros tell the decoder how many
// more bits to read. So 1→"1", 2→"010", 5→"00101". Delta (δ) improves on γ for larger numbers by encoding the
// LENGTH itself with γ instead of unary: write γ(bitlength(n)), then n's bits after the leading 1. δ beats γ
// once numbers get past ~32. Both are prefix-free, so a stream decodes unambiguously. These power inverted-index
// and column-store compression (often as a fallback where a tuned code like Golomb-Rice doesn't fit).
// Reference: Elias, "Universal codeword sets and representations of the integers" (IEEE IT, 1975).

/** γ-encode a positive integer to a bit string: ⌊log2 n⌋ zeros, then n in binary. */
export function gammaEncode(n: number): string {
  if (n < 1) throw new Error('Elias codes require n >= 1');
  const bin = n.toString(2);          // always begins with '1'
  return '0'.repeat(bin.length - 1) + bin;
}

/** δ-encode: γ(bitlength(n)) followed by n's bits after the leading 1. */
export function deltaEncode(n: number): string {
  if (n < 1) throw new Error('Elias codes require n >= 1');
  const bin = n.toString(2);
  return gammaEncode(bin.length) + bin.slice(1);
}

/** Decode one γ code starting at `pos`; returns the value and the next position. */
export function gammaDecodeOne(bits: string, pos = 0): { value: number; next: number } {
  let k = 0;
  while (bits[pos + k] === '0') k++;    // count leading zeros
  const chunk = bits.slice(pos + k, pos + k + k + 1); // k+1 bits, MSB is the '1'
  return { value: parseInt(chunk, 2), next: pos + k + k + 1 };
}

/** Decode one δ code starting at `pos`. */
export function deltaDecodeOne(bits: string, pos = 0): { value: number; next: number } {
  const { value: len, next } = gammaDecodeOne(bits, pos); // bitlength(n)
  const rem = bits.slice(next, next + len - 1);
  return { value: parseInt('1' + rem, 2), next: next + len - 1 }; // restore the dropped leading 1
}

const encodeList = (ns: number[], enc: (n: number) => string) => ns.map(enc).join('');
const decodeList = (bits: string, dec: (b: string, p: number) => { value: number; next: number }) => {
  const out: number[] = []; let pos = 0;
  while (pos < bits.length) { const { value, next } = dec(bits, pos); out.push(value); pos = next; }
  return out;
};

export const gammaEncodeList = (ns: number[]) => encodeList(ns, gammaEncode);
export const deltaEncodeList = (ns: number[]) => encodeList(ns, deltaEncode);
export const gammaDecodeList = (bits: string) => decodeList(bits, gammaDecodeOne);
export const deltaDecodeList = (bits: string) => decodeList(bits, deltaDecodeOne);

/** Bit length of a fixed 32-bit encoding, for comparison. */
export const fixedBits = (ns: number[]) => ns.length * 32;
