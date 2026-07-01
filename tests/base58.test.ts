import { describe, it, expect } from 'vitest';
import { encode, decode, encodeCheck, decodeCheck, toHex, fromHex, ALPHABET } from '../src/web/base58';

describe('the alphabet', () => {
  it('has 58 symbols and omits the confusable 0 O I l', () => {
    expect(ALPHABET.length).toBe(58);
    expect(/[0OIl]/.test(ALPHABET)).toBe(false);
  });
});

describe('Base58 encode/decode against the Bitcoin test vectors', () => {
  const vectors: [string, string][] = [
    ['61', '2g'], ['626262', 'a3gV'], ['636363', 'aPEr'], ['516b6fcd0f', 'ABnLTmg'],
    ['00010966776006953d5567439e5e39f86a0d273beed61967f6', '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM'],
  ];
  it('encodes each vector exactly', () => {
    for (const [hex, b58] of vectors) expect(encode(fromHex(hex))).toBe(b58);
  });
  it('decodes back to the original bytes', () => {
    for (const [hex, b58] of vectors) expect(toHex(decode(b58))).toBe(hex);
  });
  it('encodes each leading zero byte as a literal "1"', () => {
    expect(encode(new Uint8Array([0, 0, 1]))).toBe('112');
    expect(toHex(decode(encode(new Uint8Array([0, 0, 5]))))).toBe('000005');
  });
  it('round-trips 5000 random byte strings', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let i = 0; i < 5000; i++) {
      const bytes = new Uint8Array(Array.from({ length: rnd(30) }, () => rnd(256)));
      expect(toHex(decode(encode(bytes)))).toBe(toHex(bytes));
    }
  });
  it('rejects an out-of-alphabet character', () => {
    expect(() => decode('0OIl')).toThrow();
  });
});

describe('Base58Check (real double-SHA256 checksum)', () => {
  const HASH160 = '010966776006953d5567439e5e39f86a0d273bee';
  const ADDR = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM';
  it('reproduces the known Bitcoin address from version 0x00 + hash160', async () => {
    expect(await encodeCheck(0x00, fromHex(HASH160))).toBe(ADDR);
  });
  it('decodes and verifies the checksum, recovering version + payload', async () => {
    const r = await decodeCheck(ADDR);
    expect(r.valid).toBe(true);
    expect(r.version).toBe(0);
    expect(toHex(r.payload)).toBe(HASH160);
  });
  it('flags a single mistyped character as an invalid checksum', async () => {
    const bad = ADDR.slice(0, -1) + (ADDR.endsWith('a') ? 'b' : 'a');
    expect((await decodeCheck(bad)).valid).toBe(false);
  });
});
