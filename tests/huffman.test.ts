import { describe, it, expect } from 'vitest';
import { counts, buildTree, buildCodes, encode, decode } from '../src/web/huffman';

describe('Huffman properties', () => {
  it('counts symbols', () => {
    expect(counts('abracadabra')).toEqual({ a: 5, b: 2, r: 2, c: 1, d: 1 });
  });

  it('codes are prefix-free (no code is a prefix of another)', () => {
    const codes = Object.values(buildCodes(buildTree(counts('abracadabra'))));
    for (const a of codes) for (const b of codes) if (a !== b) expect(b.startsWith(a)).toBe(false);
  });

  it('frequent symbols get codes no longer than rare ones', () => {
    const codes = buildCodes(buildTree(counts('abracadabra')));
    expect(codes.a.length).toBeLessThanOrEqual(codes.c.length); // a (×5) ≤ c (×1)
    expect(codes.a.length).toBeLessThanOrEqual(codes.d.length);
  });

  it('encode then decode round-trips exactly', () => {
    for (const s of ['abracadabra', 'hello world', 'mississippi', 'aaaa']) {
      const r = encode(s);
      expect(decode(r.bits, buildTree(counts(s)))).toBe(s);
    }
  });

  it('total bits equals Σ freq·codelen and beats fixed-width on skewed text', () => {
    const s = 'aaaaaaaabbbbccd'; // very skewed
    const r = encode(s);
    const cnt = counts(s);
    const expected = Object.entries(cnt).reduce((n, [ch, f]) => n + f * r.codes[ch].length, 0);
    expect(r.compressedBits).toBe(expected);
    expect(r.compressedBits).toBeLessThan(r.originalBits); // compresses
    expect(r.ratio).toBeLessThan(1);
  });

  it('a single distinct symbol still gets a 1-bit code', () => {
    expect(encode('aaaa').codes.a).toBe('0');
    expect(encode('aaaa').compressedBits).toBe(4);
  });
});
