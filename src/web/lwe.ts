// Post-quantum crypto, the lattice kernel made visible. Learning With Errors (LWE):
// publish A and b = A·s + e where e is small noise; recovering the secret s from
// (A, b) is believed hard even for a quantum computer (no periodic/factoring
// structure for Shor's algorithm to grab). Regev encryption rides on it: a message
// bit is hidden near 0 or q/2 and survives the noise because we round. This is the
// real idea inside ML-KEM (Kyber) — Kyber just works over polynomial rings with
// q=3329 and packs 256 bits at once. Small, honest, deterministic params here.

export interface LweParams { n: number; q: number }
export const PARAMS: LweParams = { n: 4, q: 97 };
export const half = (q: number) => Math.round(q / 2);

const mod = (x: number, q: number) => ((x % q) + q) % q;
export const dot = (a: number[], b: number[], q: number) => mod(a.reduce((s, ai, i) => s + ai * b[i], 0), q);
export const matVec = (A: number[][], v: number[], q: number) => A.map((row) => dot(row, v, q));
export const transpose = (A: number[][]) => A[0].map((_, j) => A.map((row) => row[j]));

export interface PublicKey { A: number[][]; b: number[] }

/** Public key b = A·s + e (mod q); s is the secret, e the small noise hiding it. */
export function keyGen(A: number[][], s: number[], e: number[], q: number): PublicKey {
  const As = matVec(A, s, q);
  return { A, b: As.map((x, i) => mod(x + e[i], q)) };
}

export interface Cipher { u: number[]; v: number }

/** Encrypt one bit: u = Aᵀ·r + e1, v = b·r + e2 + bit·⌊q/2⌋ (mod q). */
export function encryptBit(pk: PublicKey, r: number[], e1: number[], e2: number, bit: 0 | 1, q: number): Cipher {
  const u = matVec(transpose(pk.A), r, q).map((x, i) => mod(x + e1[i], q));
  const v = mod(dot(pk.b, r, q) + e2 + bit * half(q), q);
  return { u, v };
}

export interface Decryption { raw: number; centered: number; noise: number; bit: 0 | 1 }

/** Decrypt: m = v − s·u ≈ bit·⌊q/2⌋ + (small). Round to the nearer of 0 / ⌊q/2⌋. */
export function decryptBit(s: number[], c: Cipher, q: number): Decryption {
  const raw = mod(c.v - dot(s, c.u, q), q);
  const bit: 0 | 1 = raw > q / 4 && raw < (3 * q) / 4 ? 1 : 0;
  const ideal = bit * half(q);
  let noise = raw - ideal;
  if (noise > q / 2) noise -= q;
  if (noise < -q / 2) noise += q;
  const centered = raw > q / 2 ? raw - q : raw;
  return { raw, centered, noise, bit };
}

/** The decryption noise e·r + e2 − s·e1 — correct only while |noise| < q/4. */
export function noiseMargin(q: number) { return Math.floor(q / 4); }
