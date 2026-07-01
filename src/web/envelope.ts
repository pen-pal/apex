// Envelope encryption — how AWS KMS, Google Cloud KMS, and every serious secrets system encrypt data at
// scale without ever exposing the master key. You do NOT encrypt your data directly with the master key. Two
// layers: (1) generate a fresh random DATA ENCRYPTION KEY (DEK) and encrypt the actual data with it; (2) ask
// the KMS to encrypt (WRAP) that little DEK with a KEY-ENCRYPTION KEY (KEK) that never leaves the KMS's
// hardware. You store the ciphertext next to the wrapped DEK. To read the data you send the wrapped DEK to the
// KMS, it unwraps it (the only place the KEK exists), hands back the plaintext DEK, and you decrypt locally.
// Two payoffs. The master KEK never touches your servers or your data — compromising an app server leaks at
// most one DEK, not the master key. And key ROTATION is nearly free: to rotate the master key you only
// re-wrap the tiny DEKs, never the terabytes of data they protect. This models the DEK/KEK hierarchy, wrapping,
// decryption, and rotation with a small but real reversible stream cipher. Reference: NIST key-wrapping;
// AWS/GCP KMS envelope-encryption docs.

// A tiny hash-based stream cipher (teaching model): keystream byte from (key, position); XOR to en/decrypt.
const ksByte = (key: number, i: number): number => {
  let h = (Math.imul(key ^ (i * 2654435761), 2246822519)) >>> 0;
  h = ((h ^ (h >>> 15)) >>> 0);
  return h & 0xff;
};
const cipher = (data: number[], key: number): number[] => data.map((b, i) => b ^ ksByte(key, i)); // symmetric

const num4 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const bytes4 = (b: number[]): number => ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;

export interface Envelope { ciphertext: number[]; wrappedDEK: number[] }

/** Encrypt the data under a fresh DEK, then wrap the DEK under the KEK. The KEK never sees the data. */
export function envelopeEncrypt(plaintext: number[], kek: number, dek: number): Envelope {
  return { ciphertext: cipher(plaintext, dek), wrappedDEK: cipher(num4(dek), kek) };
}

/** Unwrap the DEK using the KEK (in the KMS, this is the only place the KEK exists). */
export const unwrapDEK = (wrappedDEK: number[], kek: number): number => bytes4(cipher(wrappedDEK, kek));

/** Decrypt: unwrap the DEK with the KEK, then decrypt the data with the DEK. */
export function envelopeDecrypt(env: Envelope, kek: number): number[] {
  return cipher(env.ciphertext, unwrapDEK(env.wrappedDEK, kek));
}

/** Rotate the master key: re-wrap the DEK under a new KEK. The ciphertext (the big data) is NEVER touched. */
export function rotateKEK(env: Envelope, oldKek: number, newKek: number): Envelope {
  const dek = unwrapDEK(env.wrappedDEK, oldKek);
  return { ciphertext: env.ciphertext, wrappedDEK: cipher(num4(dek), newKek) };
}

export const bytes = (s: string): number[] => [...s].flatMap((c) => [...new TextEncoder().encode(c)]);
export const str = (b: number[]): string => new TextDecoder().decode(new Uint8Array(b));
