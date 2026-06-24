import { describe, it, expect } from 'vitest';
import { xorBytes, otpEncrypt, keyFor } from '../src/web/otpad';

const enc = (s: string) => new TextEncoder().encode(s);
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('one-time pad', () => {
  it('encrypt == decrypt (XOR the key back)', () => {
    const m = enc('attack at dawn');
    const k = Uint8Array.from({ length: m.length }, (_, i) => (i * 37 + 11) & 0xff);
    const c = otpEncrypt(m, k);
    expect(hex(c)).not.toBe(hex(m)); // scrambled
    expect(hex(otpEncrypt(c, k))).toBe(hex(m)); // round-trips
  });

  it('perfect secrecy: for any target message there is a key producing the same ciphertext', () => {
    const m = enc('YES');
    const k = Uint8Array.from([0x10, 0x20, 0x30]);
    const c = otpEncrypt(m, k);
    const decoy = enc('NOO');
    const fakeKey = keyFor(c, decoy); // the key an attacker would need to "find" NOO
    expect(hex(otpEncrypt(c, fakeKey))).toBe(hex(decoy)); // same ciphertext decrypts to the decoy
  });
});

describe('key reuse is fatal', () => {
  it('reusing the pad cancels the key: C1 ⊕ C2 == P1 ⊕ P2', () => {
    const p1 = enc('the password is'), p2 = enc('meet me at noon');
    const key = Uint8Array.from({ length: p1.length }, (_, i) => (i * 53 + 7) & 0xff);
    const c1 = otpEncrypt(p1, key), c2 = otpEncrypt(p2, key); // SAME key
    expect(hex(xorBytes(c1, c2))).toBe(hex(xorBytes(p1, p2))); // the pad vanishes
  });
});
