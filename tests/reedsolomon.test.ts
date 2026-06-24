import { describe, it, expect } from 'vitest';
import { gmul, gdiv, encode, decode } from '../src/web/reedsolomon';

describe('GF(256) arithmetic (Rijndael field)', () => {
  it('matches the FIPS-197 worked product 0x57 · 0x83 = 0xc1', () => {
    expect(gmul(0x57, 0x83)).toBe(0xc1);
  });
  it('0 annihilates and multiply/divide are inverse', () => {
    expect(gmul(0, 0x9a)).toBe(0);
    for (const a of [1, 0x53, 0xff, 0x10]) for (const b of [1, 0x02, 0xca, 0x80])
      expect(gdiv(gmul(a, b), b)).toBe(a);
  });
});

const DATA = [0xde, 0xad, 0xbe, 0xef]; // k = 4

describe('Reed-Solomon encoding', () => {
  it('is systematic — the first k symbols are the data', () => {
    const cw = encode(DATA, 7); // n = 7 → 3 parity symbols
    expect(cw.slice(0, 4)).toEqual(DATA);
    expect(cw).toHaveLength(7);
  });
});

describe('erasure recovery: lose any n-k symbols, still recover', () => {
  const n = 7, k = 4;
  const cw = encode(DATA, n);

  const eraseAt = (idxs: number[]) => cw.map((v, i) => (idxs.includes(i) ? null : v));

  it('recovers from 3 erasures in the data region', () => {
    expect(decode(eraseAt([0, 1, 2]), k)).toEqual(DATA);
  });
  it('recovers from 3 erasures spread across data and parity', () => {
    expect(decode(eraseAt([1, 3, 6]), k)).toEqual(DATA);
  });
  it('recovers from 3 erasures all in the parity region', () => {
    expect(decode(eraseAt([4, 5, 6]), k)).toEqual(DATA);
  });
  it('recovers when nothing is lost', () => {
    expect(decode(cw, k)).toEqual(DATA);
  });
  it('fails (returns null) when more than n-k symbols are lost', () => {
    expect(decode(eraseAt([0, 1, 2, 3]), k)).toBe(null); // only 3 survive, need 4
  });
});

describe('a larger code', () => {
  it('RS(10,6) recovers from any 4 erasures', () => {
    const data = [1, 2, 3, 4, 5, 6];
    const cw = encode(data, 10);
    const lost = cw.map((v, i) => ([2, 4, 7, 9].includes(i) ? null : v));
    expect(decode(lost, 6)).toEqual(data);
  });
});
