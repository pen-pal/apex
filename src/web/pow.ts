// Proof of Work (Hashcash, and the heart of Bitcoin mining). A hash is a one-way
// random-looking function, so the only way to find an input whose hash starts with d
// zero BITS is to try ~2^d inputs. That makes work measurable and forgery expensive:
// to rewrite a block you'd have to redo its proof and every block after it. Real
// SHA-256 from sha256.ts (verified to NIST), so every hash here is genuine. We grind
// a nonce until the digest clears the difficulty target.
import { sha256, concatBytes } from './sha256';

/** Number of leading zero BITS in a digest. */
export function leadingZeroBits(h: Uint8Array): number {
  let bits = 0;
  for (const byte of h) {
    if (byte === 0) { bits += 8; continue; }
    for (let m = 7; m >= 0; m--) { if ((byte >> m) & 1) return bits; bits++; }
    break;
  }
  return bits;
}

export interface Mined {
  found: boolean;
  nonce: number;
  hash: Uint8Array;
  tries: number;
  zeroBits: number;
}

const enc = (s: string) => new TextEncoder().encode(s);

/** Grind nonces from `start` until sha256(data ‖ nonce) has ≥ `difficulty` leading
 *  zero bits, or `maxTries` is reached. Deterministic: nonces increase from `start`. */
export function mine(data: string, difficulty: number, maxTries: number, start = 0): Mined {
  const base = enc(data);
  for (let nonce = start; nonce < start + maxTries; nonce++) {
    const hash = sha256(concatBytes(base, enc(String(nonce))));
    const z = leadingZeroBits(hash);
    if (z >= difficulty) return { found: true, nonce, hash, tries: nonce - start + 1, zeroBits: z };
  }
  const lastNonce = start + maxTries - 1;
  return { found: false, nonce: lastNonce, hash: sha256(concatBytes(base, enc(String(lastNonce)))), tries: maxTries, zeroBits: 0 };
}

/** Verify a claimed nonce really clears the target (what every other node does). */
export function verify(data: string, nonce: number, difficulty: number): boolean {
  return leadingZeroBits(sha256(concatBytes(enc(data), enc(String(nonce))))) >= difficulty;
}

export const expectedTries = (difficulty: number): number => Math.pow(2, difficulty);
