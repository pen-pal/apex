import { describe, it, expect } from 'vitest';
import { ecdsaSign, ecdsaVerify, publicKey, recoverFromReuse, curveOrder } from '../src/web/ecdsa';

describe('ECDSA on the toy curve (order N = 19)', () => {
  it('the subgroup order is 19', () => {
    expect(curveOrder).toBe(19);
  });

  it('a signature produced with d=7, k=3, z=10 is (r=10, s=14) and verifies', () => {
    const d = 7, Q = publicKey(d);
    const sig = ecdsaSign(10, d, 3);
    expect(sig).toEqual({ r: 10, s: 14 }); // hand-derived from the ECDSA equations
    expect(ecdsaVerify(10, sig, Q)).toBe(true);
  });

  it('verification fails if the message hash is changed', () => {
    const d = 7, Q = publicKey(d);
    const sig = ecdsaSign(10, d, 3);
    expect(ecdsaVerify(11, sig, Q)).toBe(false); // different z → reject
  });

  it('verification fails against the wrong public key', () => {
    const sig = ecdsaSign(10, 7, 3);
    expect(ecdsaVerify(10, sig, publicKey(9))).toBe(false);
  });

  it('signs and verifies across many (d, k, z) combinations', () => {
    for (let d = 1; d < 19; d++)
      for (const k of [2, 5, 11]) for (const z of [1, 8, 17]) {
        const sig = ecdsaSign(z, d, k);
        if (sig.r === 0 || sig.s === 0) continue;
        expect(ecdsaVerify(z, sig, publicKey(d))).toBe(true);
      }
  });
});

describe('nonce reuse recovers the private key (the PS3 / Bitcoin bug)', () => {
  it('two signatures with the same k expose d', () => {
    const d = 7, k = 3;
    const s1 = ecdsaSign(10, d, k); // message hash 10
    const s2 = ecdsaSign(5, d, k); // message hash 5, SAME k → same r
    expect(s1.r).toBe(s2.r); // the tell-tale: identical r

    const rec = recoverFromReuse(10, s1.s, 5, s2.s, s1.r);
    expect(rec.k).toBe(3); // the nonce
    expect(rec.d).toBe(7); // the PRIVATE KEY
  });

  it('recovers d for several keys', () => {
    for (const d of [4, 9, 13, 17]) {
      const k = 5;
      const a = ecdsaSign(3, d, k), b = ecdsaSign(11, d, k);
      expect(recoverFromReuse(3, a.s, 11, b.s, a.r).d).toBe(d);
    }
  });
});
