// The hash family and the birthday bound. A hash's collision resistance is only HALF
// its output size — 2^(n/2), the birthday bound — and cryptanalysis has pushed the
// real cost of MD5 and SHA-1 far below even that. This is honest, sourced status, not
// a live collision (generating one took thousands of CPU-years).

export interface HashAlg {
  name: string;
  bits: number;
  idealCollisionBits: number; // n/2 — the birthday bound
  bestAttackBits: number; // best known collision attack complexity
  status: 'broken' | 'safe';
  event: string;
}

export const HASHES: HashAlg[] = [
  { name: 'MD5', bits: 128, idealCollisionBits: 64, bestAttackBits: 18, status: 'broken', event: 'collisions in seconds on a laptop (2004–2008); used in the Flame malware to forge a Microsoft cert' },
  { name: 'SHA-1', bits: 160, idealCollisionBits: 80, bestAttackBits: 63, status: 'broken', event: 'SHAttered (2017): two PDFs, one SHA-1. Shambles (2020): practical chosen-prefix' },
  { name: 'SHA-256', bits: 256, idealCollisionBits: 128, bestAttackBits: 128, status: 'safe', event: 'no collision attack better than brute force; the current default' },
  { name: 'SHA3-256', bits: 256, idealCollisionBits: 128, bestAttackBits: 128, status: 'safe', event: 'Keccak sponge; different construction, also no practical attack' },
];

/** Expected number of random items before a 50% chance of collision in a 2^bits space:
 *  ≈ 1.1774 · 2^(bits/2) (the birthday bound). */
export function birthday50(bits: number): number {
  return 1.1774 * Math.pow(2, bits / 2);
}

/** P(at least one collision) among k items in a 2^bits space ≈ 1 − e^(−k²/2^(bits+1)). */
export function collisionProb(k: number, bits: number): number {
  return 1 - Math.exp(-(k * k) / Math.pow(2, bits + 1));
}
