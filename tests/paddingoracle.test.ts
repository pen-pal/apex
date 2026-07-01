import { describe, it, expect } from 'vitest';
import { attackBlock, padBlock, validPKCS7, recoverIntermediate, makeOracle, B } from '../src/web/paddingoracle';

const IV = [0x9f, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x70];

describe('PKCS#7 validity — the one bit the oracle leaks', () => {
  it('accepts correct padding and rejects malformed', () => {
    expect(validPKCS7([1, 2, 3, 4, 5, 6, 7, 1])).toBe(true);   // pad 0x01
    expect(validPKCS7([1, 2, 3, 4, 5, 6, 2, 2])).toBe(true);   // pad 0x02 0x02
    expect(validPKCS7([1, 2, 3, 4, 5, 6, 3, 2])).toBe(false);  // last says 2 but prior byte ≠ 2
    expect(validPKCS7([1, 2, 3, 4, 5, 6, 7, 0])).toBe(false);  // 0 is not a valid length
    expect(validPKCS7([1, 2, 3, 4, 5, 6, 7, 9])).toBe(false);  // > block size
  });
});

describe('the attack recovers plaintext with only the padding oracle (no key)', () => {
  for (const secret of ['cash=10', 'admin', 'hi', 'abcdefg', 'A']) {
    it(`recovers "${secret}"`, () => {
      const P = padBlock(secret);
      const a = attackBlock(P, IV);
      expect(a.matches).toBe(true);
      expect(a.recovered).toEqual(P);
    });
  }
  it('recovers a block whose real last byte is 0x01 (exercises the false-positive guard)', () => {
    // "cash=10" is 7 bytes → PKCS#7 pads with a single 0x01, so the plaintext's last byte IS 0x01
    const P = padBlock('cash=10');
    expect(P[B - 1]).toBe(1);
    expect(attackBlock(P, IV).matches).toBe(true);
  });
});

describe('the attack is cheap and key-free', () => {
  it('costs on the order of a few hundred queries per block (~128/byte)', () => {
    const a = attackBlock(padBlock('secret!!'.slice(0, 7)), IV);
    expect(a.queries).toBeLessThan(256 * B * 2); // bounded well under brute forcing the block
    expect(a.queries).toBeGreaterThan(B);        // it does real work
  });
  it('recoverIntermediate learns the intermediate the oracle never reveals', () => {
    const intermediate = [10, 20, 30, 40, 50, 60, 70, 80];
    const { intermediate: got } = recoverIntermediate(makeOracle(intermediate));
    expect(got).toEqual(intermediate);
  });
});
