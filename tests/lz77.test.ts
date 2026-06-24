import { describe, it, expect } from 'vitest';
import { lz77, lz77Decode, stats, type Token } from '../src/web/lz77';

const tok = (t: Token) => `(${t.offset},${t.length},${t.next})`;

describe('LZ77 encoding', () => {
  it('compresses a run with a distance-1 copy (hand-worked)', () => {
    // "aaaaa": literal a, then copy 3 from distance 1 and append a
    const t = lz77('aaaaa');
    expect(t.map(tok)).toEqual(['(0,0,a)', '(1,3,a)']);
  });

  it('emits literals until a match exists, then the longest closest match', () => {
    // "abcabc": a b c literals, then "abc" appears at distance 3 → copy 2 + next 'c'
    const t = lz77('abcabc');
    expect(t.slice(0, 3).map(tok)).toEqual(['(0,0,a)', '(0,0,b)', '(0,0,c)']);
    const last = t[3];
    expect(last.offset).toBe(3);
    expect(last.length).toBe(2);
    expect(last.next).toBe('c');
  });
});

describe('LZ77 round-trips (encoder and decoder are independent)', () => {
  for (const s of ['aaaaa', 'abracadabra', 'abcabcabcabc', 'the rain in spain falls mainly', 'mississippi', 'a', ''])
    it(`decode(encode(${JSON.stringify(s)})) === original`, () => {
      expect(lz77Decode(lz77(s))).toBe(s);
    });
});

describe('compression accounting', () => {
  it('counts copied characters that the tokens replaced', () => {
    const input = 'abracadabra';
    const st = stats(input, lz77(input));
    expect(st.inputLen).toBe(11);
    expect(st.copiedChars).toBeGreaterThan(0);
    // the literal count + the chars produced by copies + one next per token == inputLen
    const produced = st.copiedChars + st.tokens; // each token also emits its `next`
    expect(produced).toBe(input.length);
  });

  it('a long repetition needs far fewer tokens than characters', () => {
    const input = 'ab'.repeat(40); // 80 chars
    const t = lz77(input, 64);
    expect(t.length).toBeLessThan(input.length / 3);
    expect(lz77Decode(t)).toBe(input);
  });
});
