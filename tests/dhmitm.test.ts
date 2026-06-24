import { describe, it, expect } from 'vitest';
import { exchange, pub, shared } from '../src/web/dhmitm';

describe('plain Diffie–Hellman (p=23, g=5)', () => {
  it('reproduces the canonical example: A=8, B=19, shared=2', () => {
    expect(pub(6)).toBe(8); // 5^6 mod 23
    expect(pub(15)).toBe(19); // 5^15 mod 23
    expect(shared(19, 6)).toBe(2); // B^a
    expect(shared(8, 15)).toBe(2); // A^b
  });

  it('both sides agree and no one is in the middle', () => {
    const r = exchange(6, 15, { mitm: false, eve: 3, authenticated: false });
    expect(r.aliceKey).toBe(2);
    expect(r.bobKey).toBe(2);
    expect(r.agree).toBe(true);
    expect(r.compromised).toBe(false);
  });
});

describe('active MITM on unauthenticated DH', () => {
  it('Eve shares a different key with each side and reads everything', () => {
    const r = exchange(6, 15, { mitm: true, eve: 3, authenticated: false });
    expect(r.aliceKey).toBe(6); // Alice ↔ Eve  (E^a)
    expect(r.bobKey).toBe(5); // Bob ↔ Eve   (E^b)
    expect(r.aliceKey).not.toBe(r.bobKey); // Alice and Bob do NOT share a key
    expect(r.eve!.keyWithAlice).toBe(r.aliceKey); // Eve holds Alice's key
    expect(r.eve!.keyWithBob).toBe(r.bobKey); // …and Bob's
    expect(r.compromised).toBe(true);
    expect(r.detected).toBe(false); // silent
  });
});

describe('authentication defeats the MITM', () => {
  it('signing the public value makes the substitution detectable', () => {
    const r = exchange(6, 15, { mitm: true, eve: 3, authenticated: true });
    expect(r.detected).toBe(true);
    expect(r.compromised).toBe(false);
    expect(r.aliceKey).toBe(r.bobKey); // the real exchange would complete (if not aborted)
  });
});
