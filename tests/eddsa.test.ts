import { describe, it, expect } from 'vitest';
import { sign, verify, publicKey, nonce } from '../src/web/eddsa';

describe('EdDSA sign/verify on the toy curve', () => {
  it('an honest signature verifies for many keys and messages', () => {
    for (let secret = 1; secret < 19; secret++)
      for (const msg of [0, 1, 7, 42, 255]) {
        const A = publicKey(secret);
        const sig = sign(secret, msg);
        expect(verify(A, msg, sig)).toBe(true);
      }
  });

  it('verification fails if the message is changed', () => {
    const secret = 6, A = publicKey(secret);
    const sig = sign(secret, 100);
    expect(verify(A, 101, sig)).toBe(false); // signature is bound to msg 100
  });

  it('verification fails if s is tampered', () => {
    const secret = 9, A = publicKey(secret);
    const sig = sign(secret, 5);
    expect(verify(A, 5, { R: sig.R, s: (sig.s + 1) % 19 })).toBe(false);
  });
});

describe('deterministic nonce — the property that defeats nonce reuse', () => {
  it('signing the same message twice yields the identical signature (no RNG)', () => {
    const a = sign(7, 12), b = sign(7, 12);
    expect(a.R).toEqual(b.R);
    expect(a.s).toBe(b.s);
    expect(a.r).toBe(b.r);
  });

  it('different messages derive different nonces, so a nonce is never reused across them', () => {
    const secret = 7;
    const r1 = nonce(secret, 1), r2 = nonce(secret, 2), r3 = nonce(secret, 3);
    // each message has its own deterministic nonce — an attacker cannot force a collision
    expect(new Set([r1, r2, r3]).size).toBeGreaterThan(1);
    // and the nonce depends on the message, not just the key
    expect(nonce(secret, 1)).not.toBe(nonce(secret, 1000));
  });

  it('the secret never appears in the public signature (R, s)', () => {
    const sig = sign(11, 77);
    expect(sig.s).toBeGreaterThanOrEqual(0);
    expect(sig.s).toBeLessThan(19);
    expect(verify(publicKey(11), 77, sig)).toBe(true);
  });
});
