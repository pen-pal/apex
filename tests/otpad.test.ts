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

describe('anchored to externally hand-computed bytes (not self-comparison)', () => {
  it('pins a ciphertext to a hand-XORed value', () => {
    // "YES" = 59 45 53; key = 10 20 30; XOR → 49 65 63  (computed by hand, independent of xorBytes)
    expect(hex(otpEncrypt(enc('YES'), Uint8Array.from([0x10, 0x20, 0x30])))).toBe('496563');
  });
  it('pins the decoy key (perfect-secrecy witness) to a hand-XORed value', () => {
    const c = Uint8Array.from([0x49, 0x65, 0x63]); // the ciphertext above
    // key that maps c → "NOO" (4e 4f 4f): 49^4e=07, 65^4f=2a, 63^4f=2c
    expect(hex(keyFor(c, enc('NOO')))).toBe('072a2c');
    expect(hex(otpEncrypt(c, keyFor(c, enc('NOO'))))).toBe(hex(enc('NOO'))); // and it really decrypts to the decoy
  });
  it('a key shorter than the message only covers a prefix (OTP requires equal length)', () => {
    // documents xorBytes’s min-length behaviour so a short key can’t be mistaken for safe encryption
    expect(otpEncrypt(enc('HELLO'), enc('XY')).length).toBe(2);
  });
});
