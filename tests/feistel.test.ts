import { describe, it, expect } from 'vitest';
import { roundF, roundKeys, encrypt, decrypt, encryptTrace, ROUNDS } from '../src/web/feistel';

describe('the round function is non-invertible', () => {
  it('r and 256−r collide, so F throws information away', () => {
    expect(roundF(1, 99)).toBe(roundF(255, 99)); // 1² ≡ 255² (mod 256)
    expect(roundF(10, 7)).toBe(roundF(246, 7));
  });
});

describe('Feistel decrypt reverses encrypt — despite the non-invertible F', () => {
  const keys = roundKeys(0xab);

  it('round-trips every byte pair', () => {
    for (const L of [0, 1, 42, 200, 255]) for (const R of [0, 7, 128, 255]) {
      const [cL, cR] = encrypt(L, R, keys);
      expect(decrypt(cL, cR, keys)).toEqual([L, R]);
    }
  });

  it('actually scrambles (ciphertext ≠ plaintext for a normal input)', () => {
    expect(encrypt(0x12, 0x34, keys)).not.toEqual([0x12, 0x34]);
  });

  it('the trace has one entry per round plus the start', () => {
    expect(encryptTrace(0x12, 0x34, keys)).toHaveLength(ROUNDS + 1);
  });

  it('each round swaps the halves: new L equals the previous R', () => {
    const t = encryptTrace(0x12, 0x34, keys);
    for (let i = 1; i < t.length; i++) expect(t[i].L).toBe(t[i - 1].R); // L_i = R_{i-1}
  });
});

describe('key schedule', () => {
  it('produces one key byte per round', () => {
    expect(roundKeys(0xab)).toHaveLength(ROUNDS);
    expect(roundKeys(0xab).every((k) => k >= 0 && k < 256)).toBe(true);
  });
});
