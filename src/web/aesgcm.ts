// Beyond ECB/CBC — turning the AES block cipher into a real, authenticated
// stream cipher, with the bytes kept honest:
//   • CTR mode: encrypt a counter, XOR the keystream over the data. No padding,
//     parallelisable, and encrypt == decrypt. Verified to NIST SP 800-38A F.5.
//   • Nonce reuse: reuse a (key, nonce) and the keystream repeats, so C1 ⊕ C2 =
//     P1 ⊕ P2 — the keystream cancels and the plaintexts leak. Shown, not told.
//   • GCM (AEAD): CTR for secrecy + a GHASH authentication tag over GF(2^128) for
//     integrity. Full encrypt+tag built from scratch and verified to the canonical
//     McGrew–Viega / NIST SP 800-38D GCM test vectors.
import { expandKey128, encryptBlock } from './aes';

const xorInto = (dst: Uint8Array, a: Uint8Array, b: Uint8Array, n: number) => {
  for (let j = 0; j < n; j++) dst[j] = a[j] ^ b[j];
};

/** +1 over the full 128-bit counter, big-endian (NIST SP 800-38A CTR). */
function incFull(ctr: Uint8Array) {
  for (let i = 15; i >= 0; i--) { ctr[i] = (ctr[i] + 1) & 0xff; if (ctr[i] !== 0) break; }
}
/** +1 over only the rightmost 32 bits (GCM's inc32). */
function inc32(ctr: Uint8Array) {
  for (let i = 15; i >= 12; i--) { ctr[i] = (ctr[i] + 1) & 0xff; if (ctr[i] !== 0) break; }
}

export interface CtrResult {
  keystream: Uint8Array; // AES(counter) bytes, in order
  out: Uint8Array; // data XOR keystream (ciphertext when encrypting, plaintext when decrypting)
  counters: Uint8Array[]; // each 16-byte counter block consumed
}

/** CTR-mode process (encrypt or decrypt — identical operation). */
export function aesCtr(data: Uint8Array, key: Uint8Array, icb: Uint8Array, mode: 'full' | 'gcm32' = 'full'): CtrResult {
  const rks = expandKey128(key);
  const ctr = icb.slice();
  const out = new Uint8Array(data.length);
  const keystream = new Uint8Array(data.length);
  const counters: Uint8Array[] = [];
  for (let off = 0; off < data.length; off += 16) {
    counters.push(ctr.slice());
    const ks = encryptBlock(ctr, rks);
    const n = Math.min(16, data.length - off);
    for (let j = 0; j < n; j++) { keystream[off + j] = ks[j]; out[off + j] = data[off + j] ^ ks[j]; }
    if (mode === 'gcm32') inc32(ctr); else incFull(ctr);
  }
  return { keystream, out, counters };
}

/** Build a CTR initial counter block from a nonce: nonce || 0…0 || counterStart. */
export function ctrBlock(nonce: Uint8Array, counterStart = 1): Uint8Array {
  const b = new Uint8Array(16);
  b.set(nonce.subarray(0, 12));
  b[15] = counterStart & 0xff;
  return b;
}

// ── GF(2^128) and GHASH (NIST SP 800-38D) ────────────────────────────────────
const R0 = 0xe1; // the reduction polynomial x^128 + x^7 + x^2 + x + 1, top byte

/** Multiply two 128-bit field elements in GCM's bit order. */
export function gfmul(X: Uint8Array, Y: Uint8Array): Uint8Array {
  const Z = new Uint8Array(16);
  const V = Y.slice();
  for (let i = 0; i < 128; i++) {
    if ((X[i >> 3] >> (7 - (i & 7))) & 1) for (let k = 0; k < 16; k++) Z[k] ^= V[k];
    const lsb = V[15] & 1;
    for (let k = 15; k > 0; k--) V[k] = ((V[k] >> 1) | ((V[k - 1] & 1) << 7)) & 0xff;
    V[0] = (V[0] >> 1) & 0xff;
    if (lsb) V[0] ^= R0;
  }
  return Z;
}

/** GHASH_H over a 16-byte-aligned buffer. */
export function ghash(H: Uint8Array, blocks: Uint8Array): Uint8Array {
  let X: Uint8Array = new Uint8Array(16);
  for (let off = 0; off < blocks.length; off += 16) {
    const t = new Uint8Array(16);
    for (let k = 0; k < 16; k++) t[k] = X[k] ^ blocks[off + k];
    X = gfmul(t, H);
  }
  return X;
}

function putU64BE(arr: Uint8Array, off: number, val: number) {
  for (let i = 7; i >= 0; i--) { arr[off + i] = val & 0xff; val = Math.floor(val / 256); }
}

export interface GcmResult {
  ciphertext: Uint8Array;
  tag: Uint8Array; // 16-byte authentication tag
  H: Uint8Array; // the hash subkey AES_K(0^128) — exposed for the view
}

/** J0 for a 96-bit IV: IV ‖ 0^31 ‖ 1. */
function gcmJ0(iv: Uint8Array): Uint8Array {
  const J0 = new Uint8Array(16); J0.set(iv.subarray(0, 12)); J0[15] = 1; return J0;
}

/** The GCM tag over a given ciphertext: T = GCTR_K(J0, GHASH_H(A ‖ C ‖ lens)). */
function gcmTag(H: Uint8Array, key: Uint8Array, J0: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array): Uint8Array {
  const padA = Math.ceil(aad.length / 16) * 16;
  const padC = Math.ceil(ciphertext.length / 16) * 16;
  const ghashIn = new Uint8Array(padA + padC + 16);
  ghashIn.set(aad, 0);
  ghashIn.set(ciphertext, padA);
  putU64BE(ghashIn, padA + padC, aad.length * 8);
  putU64BE(ghashIn, padA + padC + 8, ciphertext.length * 8);
  const S = ghash(H, ghashIn);
  return aesCtr(S, key, J0.slice(), 'gcm32').out; // T = GCTR_K(J0, S)
}

/** AES-128-GCM encrypt with a 96-bit IV (the common case). */
export function aesGcmEncrypt(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array, aad: Uint8Array = new Uint8Array(0)): GcmResult {
  const rks = expandKey128(key);
  const H = encryptBlock(new Uint8Array(16), rks); // hash subkey
  const J0 = gcmJ0(iv);
  const icb = J0.slice(); inc32(icb);
  const ciphertext = aesCtr(plaintext, key, icb, 'gcm32').out;
  const tag = gcmTag(H, key, J0, ciphertext, aad);
  return { ciphertext, tag, H };
}

export interface GcmOpen { plaintext: Uint8Array; authentic: boolean }

/** AES-128-GCM decrypt+verify: recompute the tag over the RECEIVED ciphertext and
 *  compare. If a byte was tampered, the tags differ and `authentic` is false. */
export function aesGcmDecrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, tag: Uint8Array, aad: Uint8Array = new Uint8Array(0)): GcmOpen {
  const rks = expandKey128(key);
  const H = encryptBlock(new Uint8Array(16), rks);
  const J0 = gcmJ0(iv);
  const expected = gcmTag(H, key, J0, ciphertext, aad);
  const icb = J0.slice(); inc32(icb);
  const plaintext = aesCtr(ciphertext, key, icb, 'gcm32').out;
  return { plaintext, authentic: tagsEqual(expected, tag) };
}

/** Constant-ish tag compare (the view uses it to accept/reject). */
export function tagsEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/** XOR two equal-length byte strings (used to show the keystream cancelling). */
export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const n = Math.min(a.length, b.length);
  const out = new Uint8Array(n);
  xorInto(out, a, b, n);
  return out;
}
