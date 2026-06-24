import { describe, it, expect } from 'vitest';
import { modpow, modpowTrace, modinv, gcd, rsaKeygen, rsaEncrypt, rsaDecrypt, rsaSign, rsaVerify, factor } from '../src/web/rsa';

describe('modular exponentiation', () => {
  it('square-and-multiply matches a direct check', () => {
    expect(modpow(4n, 13n, 497n)).toBe(445n); // textbook modexp example
    expect(modpow(65n, 17n, 3233n)).toBe(2790n);
  });
  it('the traced version returns the same value, one step per exponent bit', () => {
    const t = modpowTrace(65n, 17n, 3233n);
    expect(t.value).toBe(2790n);
    expect(t.steps.length).toBe(17n.toString(2).length); // e=17 = 10001b → 5 bits
    expect(t.steps[t.steps.length - 1].value).toBe(2790n);
  });
});

describe('modular inverse', () => {
  it('derives d = e^{-1} mod φ for the canonical example', () => {
    expect(modinv(17n, 3120n)).toBe(2753n);
    expect((17n * 2753n) % 3120n).toBe(1n);
  });
  it('refuses when e and φ share a factor', () => {
    expect(() => modinv(6n, 9n)).toThrow();
  });
  it('gcd works on BigInt', () => {
    expect(gcd(3120n, 17n)).toBe(1n);
  });
});

describe('RSA — the canonical p=61, q=53 keypair', () => {
  const key = rsaKeygen(61n, 53n, 17n);

  it('keygen yields the published n, φ and d', () => {
    expect(key.n).toBe(3233n);
    expect(key.phi).toBe(3120n);
    expect(key.d).toBe(2753n);
  });

  it('encrypt then decrypt round-trips the message 65', () => {
    const c = rsaEncrypt(65n, key);
    expect(c).toBe(2790n);
    expect(rsaDecrypt(c, key)).toBe(65n);
  });

  it('round-trips every message in the message space', () => {
    for (const m of [0n, 1n, 2n, 42n, 100n, 1000n, 3232n]) {
      expect(rsaDecrypt(rsaEncrypt(m, key), key)).toBe(m);
    }
  });

  it('a signature verifies, and tampering breaks it', () => {
    const h = 123n; // stand-in for a message hash < n
    const s = rsaSign(h, key);
    expect(rsaVerify(s, key)).toBe(h); // public exponent recovers the hash
    expect(rsaVerify(s + 1n, key)).not.toBe(h); // a forged signature does not
  });

  it('the small modulus factors trivially (why real keys are 2048+ bits)', () => {
    expect(factor(3233n)).toEqual([53n, 61n]);
  });
});
