// Varint & zigzag — how Protocol Buffers (and gRPC, and many wire formats) pack integers compactly. A
// fixed int64 always costs 8 bytes even to store the number 3. A VARINT (LEB128) instead uses 7 bits of
// each byte for data and the top bit as a CONTINUATION flag: 1 = "more bytes follow", 0 = "last byte",
// little-endian groups. So 0–127 fit in one byte, 128–16383 in two, and you only pay for the magnitude you
// actually use. The catch: a NEGATIVE number, two's-complement-extended to 64 bits, is all high bits — it
// balloons to the full 10 bytes. ZIGZAG fixes that by interleaving signs (0,-1,1,-2,2 → 0,1,2,3,4) so a
// small-magnitude negative stays small. This is exactly why proto3 has sint32/sint64. Reference: Protocol
// Buffers encoding spec; LEB128.

/** Encode a non-negative integer as an unsigned LEB128 varint (low 7-bit group first). */
export function encodeVarint(n: number): number[] {
  if (n < 0 || !Number.isFinite(n)) throw new Error('encodeVarint expects a non-negative integer');
  const out: number[] = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80; // set the continuation bit on every byte but the last
    out.push(b);
  } while (n > 0);
  return out;
}

/** Decode an unsigned varint starting at `offset`; returns the value and how many bytes it consumed. */
export function decodeVarint(bytes: number[], offset = 0): { value: number; bytesRead: number } {
  let value = 0, mult = 1, i = offset;
  for (; i < bytes.length; i++) {
    const b = bytes[i];
    value += (b & 0x7f) * mult; // little-endian: each group is more significant
    mult *= 128;
    if ((b & 0x80) === 0) return { value, bytesRead: i - offset + 1 }; // continuation clear → done
  }
  throw new Error('truncated varint (continuation bit set on the last byte)');
}

/** ZigZag: map a signed integer to a non-negative one so small magnitudes (±) stay small. 0,-1,1,-2,2 → 0,1,2,3,4. */
export const zigzagEncode = (n: number): number => (n >= 0 ? n * 2 : -n * 2 - 1);
export const zigzagDecode = (u: number): number => (u % 2 === 0 ? u / 2 : -(u + 1) / 2);

/** Encode a signed integer the way proto3 int32/int64 do WITHOUT zigzag: two's-complement to 64 bits first.
 *  A negative value becomes all-high-bits → the full 10-byte varint (the gotcha zigzag/sintN avoids). */
export function encodeVarintSigned64(n: number): number[] {
  let v = BigInt(Math.trunc(n));
  if (v < 0n) v += 1n << 64n; // 64-bit two's complement
  const out: number[] = [];
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) b |= 0x80;
    out.push(b);
  } while (v > 0n);
  return out;
}
