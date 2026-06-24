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

  it('achieves the hand-worked OPTIMAL bit count on skewed text', () => {
    const s = 'aaaaaaaabbbbccd'; // freqs a=8, b=4, c=2, d=1
    const r = encode(s);
    // optimal Huffman: a=1 bit, b=2, c=3, d=3 → 8·1 + 4·2 + 2·3 + 1·3 = 25 (external optimum,
    // = the sum of internal-node merge weights). A suboptimal-but-valid tree would exceed this.
    expect(r.compressedBits).toBe(25);
    // cross-check against the independent merge-sum reference for a couple more strings
    for (const str of ['mississippi', 'abracadabra']) {
      const cnt = counts(str);
      let freqs = Object.values(cnt).sort((a, b) => a - b);
      let optimal = 0;
      while (freqs.length > 1) { const m = freqs[0] + freqs[1]; optimal += m; freqs = [m, ...freqs.slice(2)].sort((a, b) => a - b); }
      expect(encode(str).compressedBits).toBe(optimal);
    }
  });

  it('a single distinct symbol still gets a 1-bit code', () => {
    expect(encode('aaaa').codes.a).toBe('0');
    expect(encode('aaaa').compressedBits).toBe(4);
  });
});
