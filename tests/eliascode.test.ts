import { describe, it, expect } from 'vitest';
import {
  gammaEncode, deltaEncode, gammaDecodeOne, deltaDecodeOne,
  gammaEncodeList, gammaDecodeList, deltaEncodeList, deltaDecodeList, fixedBits,
} from '../src/web/eliascode';

describe('γ code — the published encodings', () => {
  it('matches Elias γ for small integers', () => {
    expect(gammaEncode(1)).toBe('1');
    expect(gammaEncode(2)).toBe('010');
    expect(gammaEncode(3)).toBe('011');
    expect(gammaEncode(4)).toBe('00100');
    expect(gammaEncode(5)).toBe('00101');
    expect(gammaEncode(8)).toBe('0001000');
  });
  it('length is 2⌊log2 n⌋+1', () => {
    for (const n of [1, 2, 4, 7, 16, 255, 1000]) expect(gammaEncode(n).length).toBe(2 * Math.floor(Math.log2(n)) + 1);
  });
  it('rejects n < 1', () => { expect(() => gammaEncode(0)).toThrow(); });
});

describe('δ code — the published encodings', () => {
  it('matches Elias δ for small integers', () => {
    expect(deltaEncode(1)).toBe('1');
    expect(deltaEncode(2)).toBe('0100');
    expect(deltaEncode(4)).toBe('01100');
    expect(deltaEncode(5)).toBe('01101');
  });
});

describe('both codes round-trip every integer', () => {
  it('encode then decode recovers n for 1..20000', () => {
    for (let n = 1; n <= 20000; n++) {
      expect(gammaDecodeOne(gammaEncode(n)).value).toBe(n);
      expect(deltaDecodeOne(deltaEncode(n)).value).toBe(n);
    }
  });
});

describe('the codes are self-delimiting (prefix-free)', () => {
  it('a concatenated stream decodes back unambiguously with no separators', () => {
    const list = [5, 1, 1, 42, 3, 1000, 7, 256, 2];
    expect(gammaDecodeList(gammaEncodeList(list))).toEqual(list);
    expect(deltaDecodeList(deltaEncodeList(list))).toEqual(list);
  });
});

describe('size trade-offs', () => {
  it('δ beats γ for large numbers; both crush fixed-width for a run of them', () => {
    const big = Array.from({ length: 200 }, (_, i) => 1000 + i * 7);
    const g = gammaEncodeList(big).length, d = deltaEncodeList(big).length;
    expect(d).toBeLessThan(g);            // δ wins once numbers are large
    expect(g).toBeLessThan(fixedBits(big)); // both beat 32 bits each
  });
  it('γ is smallest for tiny numbers', () => {
    expect(gammaEncode(1).length).toBe(1);
    expect(gammaEncode(2).length).toBeLessThanOrEqual(deltaEncode(2).length);
  });
});
