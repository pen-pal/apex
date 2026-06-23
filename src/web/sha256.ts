// A from-scratch SHA-256 (FIPS 180-4) — needed because the length-extension
// attack requires RESUMING the hash from a known digest, which WebCrypto won't
// let you do. Verified against the NIST "abc" vector, and the attack itself is
// proven end-to-end in tests (a forged MAC validates against the real secret).
// This is exactly WHY HMAC exists instead of H(secret || message).

// prettier-ignore
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const H0 = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);

const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;

function compress(H: Uint32Array, block: Uint8Array, off: number) {
  const w = new Uint32Array(64);
  for (let i = 0; i < 16; i++)
    w[i] = ((block[off + 4 * i] << 24) | (block[off + 4 * i + 1] << 16) | (block[off + 4 * i + 2] << 8) | block[off + 4 * i + 3]) >>> 0;
  for (let i = 16; i < 64; i++) {
    const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
    const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
  }
  let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
  for (let i = 0; i < 64; i++) {
    const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
    const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) >>> 0;
    h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
  }
  H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
  H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
}

function stateToBytes(H: Uint32Array): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = (H[i] >>> 16) & 0xff; out[4 * i + 2] = (H[i] >>> 8) & 0xff; out[4 * i + 3] = H[i] & 0xff; }
  return out;
}

/**
 * The Merkle–Damgård padding: 0x80, zero-fill to a 64-byte boundary, then the
 * 64-bit big-endian *total* message bit length. `alignLen` is the byte count
 * since the last block boundary; `totalLenBytes` feeds the length field.
 */
export function mdPadding(alignLen: number, totalLenBytes: number): Uint8Array {
  const padZeros = ((56 - ((alignLen + 1) % 64)) + 64) % 64;
  const out = new Uint8Array(1 + padZeros + 8);
  out[0] = 0x80;
  let bl = BigInt(totalLenBytes) * 8n;
  for (let i = out.length - 1; i >= out.length - 8; i--) { out[i] = Number(bl & 0xffn); bl >>= 8n; }
  return out;
}

const concat = (...arrs: Uint8Array[]): Uint8Array => {
  const n = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};

/** Standard SHA-256 of a message. */
export function sha256(msg: Uint8Array): Uint8Array {
  const H = Uint32Array.from(H0);
  const buf = concat(msg, mdPadding(msg.length, msg.length));
  for (let off = 0; off < buf.length; off += 64) compress(H, buf, off);
  return stateToBytes(H);
}

/** Parse a 32-byte digest back into the 8-word internal state (to resume from). */
export function stateFromDigest(d: Uint8Array): Uint32Array {
  const H = new Uint32Array(8);
  for (let i = 0; i < 8; i++) H[i] = ((d[4 * i] << 24) | (d[4 * i + 1] << 16) | (d[4 * i + 2] << 8) | d[4 * i + 3]) >>> 0;
  return H;
}

export interface LengthExtension {
  glue: Uint8Array; // the original message's padding, which the attacker re-creates
  forgedMac: Uint8Array; // a VALID MAC for the forged message — computed without the secret
}

/**
 * Forge SHA-256(secret || msg || glue || extension) given only the original MAC
 * = SHA-256(secret || msg), the guessed total length (secretLen + msg.length),
 * and the desired extension. The secret is never used.
 */
export function sha256LengthExtend(origMac: Uint8Array, origTotalLen: number, extension: Uint8Array): LengthExtension {
  const glue = mdPadding(origTotalLen, origTotalLen);
  const prefixLen = origTotalLen + glue.length; // a multiple of 64 — extension starts on a boundary
  const H = stateFromDigest(origMac);
  const buf = concat(extension, mdPadding(extension.length, prefixLen + extension.length));
  for (let off = 0; off < buf.length; off += 64) compress(H, buf, off);
  return { glue, forgedMac: stateToBytes(H) };
}

export const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export { concat as concatBytes };
