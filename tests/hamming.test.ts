import { describe, it, expect } from 'vitest';
import { encode, syndrome, decode } from '../src/web/hamming';

const words = () => Array.from({ length: 16 }, (_, w) => [(w >> 3) & 1, (w >> 2) & 1, (w >> 1) & 1, w & 1]);

describe('encoding', () => {
  it('places data at 3,5,6,7 and even parity at 1,2,4', () => {
    expect(encode([1, 0, 1, 1])).toEqual([0, 1, 1, 0, 0, 1, 1]); // codeword 0110011
    const c = encode([1, 0, 1, 1]);
    expect([c[2], c[4], c[5], c[6]]).toEqual([1, 0, 1, 1]); // data recoverable at positions 3,5,6,7
    expect(syndrome(c)).toBe(0); // a clean codeword has zero syndrome
  });
});

describe('the syndrome is the binary index of the flipped bit', () => {
  it('for every codeword, flipping position p yields syndrome exactly p', () => {
    for (const data of words()) {
      const c = encode(data);
      for (let p = 1; p <= 7; p++) {
        const bad = c.slice(); bad[p - 1] ^= 1;
        expect(syndrome(bad)).toBe(p);
      }
    }
  });
});

describe('single-error correction is exhaustive and exact', () => {
  it('corrects every single-bit error across all 16 data words (128 cases)', () => {
    for (const data of words()) {
      const c = encode(data);
      expect(decode(c)).toMatchObject({ data, errorPos: 0 }); // clean
      for (let p = 1; p <= 7; p++) {
        const bad = c.slice(); bad[p - 1] ^= 1;
        const dec = decode(bad);
        expect(dec.errorPos).toBe(p);
        expect(dec.data).toEqual(data); // original data recovered
      }
    }
  });

  it('a double-bit error is (honestly) miscorrected — (7,4) cannot fix two', () => {
    const c = encode([1, 0, 1, 1]);
    const two = c.slice(); two[0] ^= 1; two[2] ^= 1; // flip positions 1 and 3
    expect(decode(two).data).not.toEqual([1, 0, 1, 1]); // it "corrects" the wrong bit
  });
});
