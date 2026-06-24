import { describe, it, expect } from 'vitest';
import { dhExchange, dhBruteForce, modpow } from '../src/web/dh';

// The textbook Diffie–Hellman example: p = 23, g = 5, a = 6, b = 15.
// g^a mod p = 5^6 mod 23 = 8 ; g^b mod p = 5^15 mod 23 = 19 ; shared = 2.
describe('Diffie–Hellman shared secret (p=23, g=5)', () => {
  const r = dhExchange(23n, 5n, 6n, 15n);
  it('computes the published public values', () => {
    expect(r.A).toBe(8n);
    expect(r.B).toBe(19n);
  });
  it('both sides derive the same secret g^ab mod p = 2', () => {
    expect(r.sharedAlice).toBe(2n);
    expect(r.sharedBob).toBe(2n);
    expect(r.agree).toBe(true);
  });
  it('A^b ≡ B^a ≡ g^ab (the symmetry that makes it work)', () => {
    expect(modpow(r.A, 15n, 23n)).toBe(modpow(r.B, 6n, 23n));
    expect(modpow(5n, 6n * 15n, 23n)).toBe(2n);
  });
});

describe('discrete log is the security', () => {
  it('brute force recovers the private exponent from the public value (tiny prime)', () => {
    expect(dhBruteForce(23n, 5n, 8n).priv).toBe(6n);  // A = 8 → a = 6
    expect(dhBruteForce(23n, 5n, 19n).priv).toBe(15n); // B = 19 → b = 15
  });
  it('different private exponents still agree on the same secret', () => {
    const r = dhExchange(23n, 5n, 4n, 3n);
    expect(r.agree).toBe(true);
    expect(r.sharedAlice).toBe(modpow(5n, 12n, 23n)); // g^(a·b)
  });
});
