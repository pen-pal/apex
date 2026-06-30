// Verifiable Random Function (VRF) — a keyed hash that is unpredictable to everyone except the key
// holder, yet whose output anyone can VERIFY is correct. Feed an input x; the secret key produces a
// pseudorandom output β plus a proof π. With the public key, anyone checks that β really is the unique
// VRF output for x — but without the secret key nobody could have predicted β, and the holder can't
// "shop" for a favorable one (there's exactly one valid β per x). That combination — unpredictable but
// non-manipulable and publicly checkable — is what makes VRFs the engine of leaderless lotteries:
// blockchain leader/committee election (Algorand, Cardano's Ouroboros), DNSSEC NSEC5, and randomness
// beacons. Here we build the RSA-FDH-style VRF on the project's toy RSA. Reference: Micali, Rabin &
// Vadhan (1999); IRTF draft-irtf-cfrg-vrf.

import { N, E, D, modpow } from './blindsig';

const fnv = (s: string): number => { let h = 0x811c9dc5 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
/** Hash the input into the RSA group [1, n-1] (avoid 0, which is degenerate under exponentiation). */
export const hashToGroup = (x: string): number => 1 + (fnv('vrf|' + x) % (N - 1));
/** Derive the public output from the proof — a deterministic 0–999 "random" value. */
export const proofToOutput = (proof: number): number => fnv('out|' + proof) % 1000;

export interface Vrf { input: string; hashed: number; proof: number; output: number }

/** Prove: π = H(x)^d mod n (only the secret key can compute it); β = H'(π). */
export function prove(input: string): Vrf {
  const hashed = hashToGroup(input);
  const proof = modpow(hashed, D, N);
  return { input, hashed, proof, output: proofToOutput(proof) };
}

/** Verify with the public key: π^e mod n must equal H(x), and β must equal H'(π). */
export function verify(input: string, output: number, proof: number): boolean {
  return modpow(proof, E, N) === hashToGroup(input) && output === proofToOutput(proof);
}
