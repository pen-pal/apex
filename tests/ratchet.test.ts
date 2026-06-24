import { describe, it, expect } from 'vitest';
import { symStep, chain, dhStep, shortHex } from '../src/web/ratchet';

const seed = (n: number) => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + n) & 0xff);

describe('symmetric-key ratchet', () => {
  it('derives a message key and a fresh chain key, all distinct', () => {
    const ck0 = seed(1);
    const s = symStep(ck0);
    expect(shortHex(s.mk)).not.toBe(shortHex(s.ck));
    expect(shortHex(s.ck)).not.toBe(shortHex(ck0)); // chain advanced
  });

  it('is deterministic and gives every message its own key', () => {
    const c = chain(seed(1), 5);
    const mks = c.map((x) => shortHex(x.mk, 8));
    expect(new Set(mks).size).toBe(5); // all unique
    expect(chain(seed(1), 5).map((x) => shortHex(x.mk))).toEqual(c.map((x) => shortHex(x.mk))); // reproducible
  });

  it('forward secrecy: you can resume from a later chain key but not recover earlier MKs', () => {
    const full = chain(seed(1), 4);
    // hold only CK at index 2 (as the app would, having deleted earlier state)
    const resumed = chain(full[2].ck, 2);
    expect(shortHex(resumed[0].mk)).toBe(shortHex(full[2].mk)); // future keys reproducible
    // the later chain key cannot reproduce MK0/MK1 — they aren't in the forward chain
    expect(resumed.map((x) => shortHex(x.mk))).not.toContain(shortHex(full[0].mk));
    expect(resumed.map((x) => shortHex(x.mk))).not.toContain(shortHex(full[1].mk));
  });
});

describe('DH ratchet (post-compromise healing)', () => {
  it('a new DH secret reseeds the root and chain to values an old-key attacker cannot predict', () => {
    const rk = seed(9);
    const a = dhStep(rk, seed(2));
    const b = dhStep(rk, seed(3)); // different DH secret
    expect(shortHex(a.rk)).not.toBe(shortHex(b.rk));
    expect(shortHex(a.ck)).not.toBe(shortHex(b.ck));
    // the new chain is independent of the old root-key chain
    expect(shortHex(a.ck)).not.toBe(shortHex(rk));
  });

  it('is deterministic for the same inputs', () => {
    expect(shortHex(dhStep(seed(9), seed(2)).rk, 8)).toBe(shortHex(dhStep(seed(9), seed(2)).rk, 8));
  });
});
