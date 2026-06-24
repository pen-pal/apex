// Poly1305 (RFC 8439 §2.5) — the one-time authenticator paired with ChaCha20. It's a
// polynomial evaluated in the prime field 2¹³⁰−5: chop the message into 16-byte
// coefficients, each gets a high "1" bit appended, and accumulate acc = (acc + block)·r
// mod p, then add s and truncate to 128 bits. The key (r, s) must be UNIQUE per message
// (in ChaCha20-Poly1305 it's the cipher's first keystream block) — reuse and the MAC
// is forgeable, the same nonce-reuse lesson again. Real BigInt math, verified to the
// RFC test vector.

const P = (1n << 130n) - 5n;
const CLAMP = 0x0ffffffc0ffffffc0ffffffc0fffffffn;

const leNum = (bytes: Uint8Array): bigint => {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
  return n;
};

export interface PolyStep { block: number; coeff: bigint; acc: bigint }

export interface PolyResult { r: bigint; s: bigint; tag: Uint8Array; steps: PolyStep[] }

/** Compute the Poly1305 tag of `msg` under the 32-byte one-time key. */
export function poly1305(msg: Uint8Array, key: Uint8Array): PolyResult {
  const r = leNum(key.subarray(0, 16)) & CLAMP; // clamp r
  const s = leNum(key.subarray(16, 32));
  let acc = 0n;
  const steps: PolyStep[] = [];
  for (let off = 0, b = 0; off < msg.length; off += 16, b++) {
    const chunk = msg.subarray(off, off + 16);
    const coeff = leNum(chunk) + (1n << BigInt(8 * chunk.length)); // append the high 1 bit
    acc = ((acc + coeff) * r) % P;
    steps.push({ block: b, coeff, acc });
  }
  acc = (acc + s) % (1n << 128n); // add s, truncate to 128 bits
  const tag = new Uint8Array(16);
  let t = acc;
  for (let i = 0; i < 16; i++) { tag[i] = Number(t & 0xffn); t >>= 8n; }
  return { r, s, tag, steps };
}

/** Constant-ish compare the receiver uses to accept/reject. */
export function verify(msg: Uint8Array, key: Uint8Array, tag: Uint8Array): boolean {
  const got = poly1305(msg, key).tag;
  let d = 0;
  for (let i = 0; i < 16; i++) d |= got[i] ^ (tag[i] ?? 0xff ^ got[i]);
  return d === 0 && tag.length === 16;
}
