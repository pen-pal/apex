import { describe, it, expect } from 'vitest';
import { encode, decode, trace, alphabetOf } from '../src/web/mtf';

describe('move-to-front encoding', () => {
  it('codes each symbol by its current list index, then moves it to the front', () => {
    expect(encode('bananaaa', ['a', 'b', 'n'])).toEqual([1, 1, 2, 1, 1, 1, 0, 0]);
  });
  it('a run of the same character becomes a run of zeros (after the first)', () => {
    expect(encode('aaaaa', ['a', 'b', 'c'])).toEqual([0, 0, 0, 0, 0]);
    // the tail of repeated a's in "xaaaa" → 0s
    expect(encode('xaaaa', ['a', 'x'])).toEqual([1, 1, 0, 0, 0]);
  });
  it('a recently-used symbol codes as a small number', () => {
    // alternating a/b keeps both near the front → all 1s after the first
    expect(encode('ababab', ['a', 'b'])).toEqual([0, 1, 1, 1, 1, 1]);
  });
});

describe('it is perfectly reversible', () => {
  for (const s of ['bananaaa', 'mississippi', 'abracadabra', 'aaaa', 'compression']) {
    it(`decode(encode("${s}")) === "${s}"`, () => {
      const alpha = alphabetOf(s);
      expect(decode(encode(s, alpha), alpha)).toBe(s);
    });
  }
});

describe('clustering payoff — BWT-style input becomes mostly small numbers', () => {
  it('the BWT of "banana" ("annb$aa") MTF-codes to small/zero values an entropy coder loves', () => {
    const bwt = 'annb$aa';
    const out = encode(bwt, alphabetOf(bwt));
    expect(Math.max(...out)).toBeLessThanOrEqual(alphabetOf(bwt).length - 1);
    expect(out.filter((x) => x === 0).length).toBeGreaterThan(0); // the run of a's yields zeros
  });
  it('trace records the list state after each move', () => {
    const t = trace('ba', ['a', 'b']);
    expect(t[0]).toEqual({ sym: 'b', index: 1, listAfter: ['b', 'a'] });
    expect(t[1]).toEqual({ sym: 'a', index: 1, listAfter: ['a', 'b'] });
  });
});
