// Paillier — additively HOMOMORPHIC public-key encryption. Its magic: you can ADD two encrypted numbers,
// or add/multiply an encrypted number by a public constant, WITHOUT the private key and WITHOUT ever
// decrypting. Multiply two ciphertexts and you get an encryption of the SUM of the plaintexts. That lets a
// server tally encrypted votes, sum encrypted salaries, or aggregate private telemetry and only the
// key-holder ever sees a total — never an individual value. It's also semantically secure: encrypting the
// same number twice gives different ciphertexts (fresh randomness r). We build the textbook scheme on a tiny
// modulus. Reference: Pascal Paillier, "Public-Key Cryptosystems Based on Composite Degree Residuosity
// Classes" (EUROCRYPT 1999).

import { modpow } from './blindsig';

// Toy key: p=7, q=11 → n=77. g = n+1 (the standard simple generator). Public: (N, G). Private: LAMBDA, MU.
export const P = 7, Q = 11, N = 77, N2 = N * N, G = N + 1; // N2 = 5929
export const LAMBDA = 30; // lcm(p-1, q-1) = lcm(6,10)
export const MU = 18;     // (L(g^LAMBDA mod n^2))^{-1} mod n  — precomputed; the test re-derives it

/** L(x) = (x − 1) / n. Exact integer division because, in Paillier, x ≡ 1 (mod n) wherever L is applied. */
export const L = (x: number) => Math.floor((x - 1) / N);

/** Encrypt m ∈ [0, n) with randomness r ∈ Z*_n: c = g^m · r^n mod n². Different r → different ciphertext. */
export function encrypt(m: number, r: number): number {
  return (modpow(G, ((m % N) + N) % N, N2) * modpow(r, N, N2)) % N2;
}

/** Decrypt with the private key: m = L(c^λ mod n²) · μ mod n. */
export function decrypt(c: number): number {
  return (L(modpow(c, LAMBDA, N2)) * MU) % N;
}

/** Homomorphic ADD: multiplying ciphertexts adds the plaintexts. dec(add(E(a),E(b))) = (a+b) mod n. */
export const add = (c1: number, c2: number): number => (c1 * c2) % N2;

/** Add a PUBLIC constant k to an encrypted value: multiply by g^k. dec = (m+k) mod n. */
export const addConst = (c: number, k: number): number => (c * modpow(G, ((k % N) + N) % N, N2)) % N2;

/** Multiply an encrypted value by a PUBLIC scalar k: raise to the k-th power. dec = (m·k) mod n. */
export const mulConst = (c: number, k: number): number => modpow(c, ((k % N) + N) % N, N2);
