// Diffie–Hellman key exchange — two parties agree on a shared secret over a
// public channel, and an eavesdropper who sees everything still can't compute it.
// Security rests on the discrete-log problem: g^a mod p is easy, recovering a is
// not. Real deployments use 2048-bit+ MODP groups (RFC 3526); the small numbers
// here are for seeing the mechanism. Pure BigInt math, tested on known examples.

/** Modular exponentiation: base^exp mod m, via square-and-multiply. */
export function modpow(base: bigint, exp: bigint, m: bigint): bigint {
  if (m === 1n) return 0n;
  let result = 1n;
  base %= m;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % m;
    exp >>= 1n;
    base = (base * base) % m;
  }
  return result;
}

export interface DhResult {
  p: bigint; g: bigint;
  a: bigint; b: bigint; // private exponents
  A: bigint; B: bigint; // public values g^a, g^b
  sharedAlice: bigint; // B^a mod p
  sharedBob: bigint; // A^b mod p
  agree: boolean;
}

/** Run a full DH exchange for given parameters and private exponents. */
export function dhExchange(p: bigint, g: bigint, a: bigint, b: bigint): DhResult {
  const A = modpow(g, a, p);
  const B = modpow(g, b, p);
  const sharedAlice = modpow(B, a, p);
  const sharedBob = modpow(A, b, p);
  return { p, g, a, b, A, B, sharedAlice, sharedBob, agree: sharedAlice === sharedBob };
}
