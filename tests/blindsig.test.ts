import { describe, it, expect } from 'vitest';
import { blind, signBlinded, unblind, verify, signDirect, modpow, modinv, N, E, D } from '../src/web/blindsig';

describe('toy RSA parameters are valid', () => {
  it('e·d ≡ 1 (mod φ): encrypt then decrypt is the identity', () => {
    expect(modpow(modpow(42, E, N), D, N)).toBe(42);
  });
  it('modinv is a real inverse', () => {
    expect((7 * modinv(7, N)) % N).toBe(1);
  });
});

describe('the blind signature round-trips to a valid signature', () => {
  const m = 100, r = 7;
  it('blind → sign(blinded) → unblind yields a signature that verifies on m', () => {
    const sig = unblind(signBlinded(blind(m, r)), r);
    expect(verify(sig, m)).toBe(true);
  });
  it('the blind path produces the EXACT same signature as signing m directly', () => {
    expect(unblind(signBlinded(blind(m, r)), r)).toBe(signDirect(m));
  });
  it('the final signature is independent of the blinding factor r', () => {
    const a = unblind(signBlinded(blind(m, 7)), 7);
    const b = unblind(signBlinded(blind(m, 29)), 29);
    expect(a).toBe(b);
    expect(verify(a, m)).toBe(true);
  });
});

describe('the signer learns nothing about the message', () => {
  it('what the signer sees (the blinded value) is not the message', () => {
    expect(blind(100, 7)).not.toBe(100);
  });
  it('different blinding factors give different blinded values for the same message', () => {
    expect(blind(100, 7)).not.toBe(blind(100, 29)); // signer can\'t link sessions
  });
  it('unblinding recovers a signature that RSA-verifies on m, though the signer never saw m', () => {
    const m = 123, r = 13;
    const blinded = blind(m, r);
    expect(signBlinded(blinded)).not.toBe(signDirect(m));  // what the signer returns ≠ the final signature
    const sig = unblind(signBlinded(blinded), r);
    expect(verify(sig, m)).toBe(true);                     // sig^E mod N === m — verifies with the PUBLIC key, independent of d
    expect(sig).toBe(signDirect(m));                       // and it is exactly the signature d would have produced
  });
});
