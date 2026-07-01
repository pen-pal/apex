import { describe, it, expect } from 'vitest';
import { modpow, modinv, keygen, encrypt, decrypt, homomorphicMultiply } from '../src/web/elgamal';

const p = 2087, g = 5, x = 1023;   // p is prime; x is the private key
const pub = keygen(p, g, x);

describe('modular primitives', () => {
  it('modpow computes base^exp mod m', () => {
    expect(modpow(5, 3, 2087)).toBe(125);
    expect(modpow(2, 10, 1000)).toBe(24);   // 1024 mod 1000
  });
  it('modinv is a true inverse mod the prime', () => {
    for (const a of [1, 2, 7, 42, 2086]) expect((a * modinv(a, p)) % p).toBe(1);
  });
});

describe('encryption round-trips', () => {
  it('decrypt(encrypt(m)) = m for many messages and randomness values', () => {
    for (const m of [1, 2, 42, 1000, 2086]) for (const k of [3, 17, 555, 2001]) {
      expect(decrypt(encrypt(m, pub, k), p, x)).toBe(m);
    }
  });
  it('the public key is y = g^x mod p', () => {
    expect(pub.y).toBe(modpow(g, x, p));
  });
});

describe('encryption is randomized (semantic security)', () => {
  it('the same message under different k gives different ciphertexts that decrypt the same', () => {
    const a = encrypt(42, pub, 7), b = encrypt(42, pub, 999);
    expect(a.c1 === b.c1 && a.c2 === b.c2).toBe(false);   // ciphertexts differ
    expect(decrypt(a, p, x)).toBe(42);
    expect(decrypt(b, p, x)).toBe(42);
  });
});

describe('multiplicatively homomorphic', () => {
  it('multiplying ciphertexts encrypts the product of the plaintexts', () => {
    const e1 = encrypt(17, pub, 11), e2 = encrypt(23, pub, 29);
    const prod = homomorphicMultiply(e1, e2, p);
    expect(decrypt(prod, p, x)).toBe((17 * 23) % p);
  });
});

describe('fuzz: round-trip and homomorphism hold everywhere', () => {
  it('20k round-trips and 20k homomorphic products', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 20000; t++) {
      const m = 1 + rnd(p - 1), k = 1 + rnd(p - 2);
      expect(decrypt(encrypt(m, pub, k), p, x)).toBe(m);
    }
    for (let t = 0; t < 20000; t++) {
      const m1 = 1 + rnd(p - 1), m2 = 1 + rnd(p - 1), k1 = 1 + rnd(p - 2), k2 = 1 + rnd(p - 2);
      const prod = homomorphicMultiply(encrypt(m1, pub, k1), encrypt(m2, pub, k2), p);
      expect(decrypt(prod, p, x)).toBe((m1 * m2) % p);
    }
  });
});
