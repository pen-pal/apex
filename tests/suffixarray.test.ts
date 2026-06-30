import { describe, it, expect } from 'vitest';
import { buildSuffixArray, sortedSuffixes, search } from '../src/web/suffixarray';

const allIndices = (text: string, pat: string) => {
  const out: number[] = [];
  for (let i = 0; i + pat.length <= text.length; i++) if (text.slice(i, i + pat.length) === pat) out.push(i);
  return out;
};

describe('suffix array of "banana"', () => {
  const s = 'banana';
  const sa = buildSuffixArray(s);
  it('sorts the suffix start positions lexicographically', () => {
    expect(sa).toEqual([5, 3, 1, 0, 4, 2]); // a, ana, anana, banana, na, nana
  });
  it('the sorted suffixes are in order', () => {
    expect(sortedSuffixes(s, sa)).toEqual(['a', 'ana', 'anana', 'banana', 'na', 'nana']);
  });
});

describe('search finds the contiguous block of matching suffixes', () => {
  const s = 'banana';
  const sa = buildSuffixArray(s);
  it('"ana" occurs at positions 1 and 3 (overlapping)', () => {
    expect(search(s, sa, 'ana').positions).toEqual([1, 3]);
  });
  it('"na" occurs at 2 and 4', () => {
    expect(search(s, sa, 'na').positions).toEqual([2, 4]);
  });
  it('a single occurrence and a non-match', () => {
    expect(search(s, sa, 'ban').positions).toEqual([0]);
    expect(search(s, sa, 'xyz').positions).toEqual([]);
  });
});

describe('agrees with a naive all-positions scan', () => {
  for (const [text, pat] of [
    ['mississippi', 'issi'],
    ['mississippi', 'ss'],
    ['abracadabra', 'abra'],
    ['aaaaaa', 'aa'],
  ] as const) {
    it(`"${pat}" in "${text}"`, () => {
      const sa = buildSuffixArray(text);
      expect(search(text, sa, pat).positions).toEqual(allIndices(text, pat));
    });
  }
});
