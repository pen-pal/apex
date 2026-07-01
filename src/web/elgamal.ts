// ElGamal encryption — a public-key scheme built directly on the Diffie–Hellman idea, and the ancestor of DSA
// and of homomorphic e-voting. Where RSA hides a message inside a modular power, ElGamal hides it by MULTIPLYING
// it with a fresh Diffie–Hellman shared secret that only the private-key holder can reconstruct. Setup: a large
// prime p and a generator g are public; the private key is a random x, and the public key is y = g^x mod p.
// To encrypt a message m (a group element), the sender picks a fresh random k, computes an ephemeral public
// value c1 = g^k, derives the shared secret s = y^k = g^(xk), and sends (c1, c2) where c2 = m·s. The receiver
// recomputes the same secret from their private key — s = c1^x = g^(kx) — and divides it out: m = c2·s⁻¹. Two
// properties fall out and matter enormously. First, encryption is RANDOMIZED: the same message under the same
// key gives a totally different ciphertext every time (because k is fresh), so it's semantically secure — you
// can't even tell if two ciphertexts encrypt the same thing. Second, it's MULTIPLICATIVELY HOMOMORPHIC:
// multiply two ciphertexts componentwise and you get an encryption of the product of the plaintexts, without
// ever decrypting — the basis for tallying encrypted votes. This models keygen, encrypt, decrypt, and the
// homomorphism with real modular arithmetic (small primes so the numbers are legible). Reference: ElGamal, "A
// Public Key Cryptosystem…" (IEEE IT, 1985).

/** modular exponentiation: base^exp mod m (square-and-multiply). */
export function modpow(base: number, exp: number, m: number): number {
  base %= m; let r = 1;
  while (exp > 0) { if (exp & 1) r = (r * base) % m; base = (base * base) % m; exp = Math.floor(exp / 2); }
  return r;
}

/** modular inverse mod a prime p, via Fermat's little theorem: a^(p-2) mod p. */
export const modinv = (a: number, p: number): number => modpow(((a % p) + p) % p, p - 2, p);

export interface PublicKey { p: number; g: number; y: number }
export interface Ciphertext { c1: number; c2: number }

/** Derive the public key y = g^x mod p from the private key x. */
export function keygen(p: number, g: number, x: number): PublicKey {
  return { p, g, y: modpow(g, x, p) };
}

/** Encrypt m in [1, p-1] with ephemeral randomness k: c1 = g^k, c2 = m·y^k (mod p). */
export function encrypt(m: number, pub: PublicKey, k: number): Ciphertext {
  const { p, g, y } = pub;
  return { c1: modpow(g, k, p), c2: (m % p * modpow(y, k, p)) % p };
}

/** Decrypt (c1, c2) with private key x: m = c2 · (c1^x)⁻¹ (mod p). */
export function decrypt(ct: Ciphertext, p: number, x: number): number {
  const s = modpow(ct.c1, x, p);      // the shared secret, recomputed
  return (ct.c2 * modinv(s, p)) % p;
}

/** Multiply two ciphertexts componentwise → an encryption of the product of the plaintexts (homomorphism). */
export function homomorphicMultiply(a: Ciphertext, b: Ciphertext, p: number): Ciphertext {
  return { c1: (a.c1 * b.c1) % p, c2: (a.c2 * b.c2) % p };
}
