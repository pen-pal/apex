import { describe, it, expect } from 'vitest';
import { search, lastOccurrence, naiveComparisons } from '../src/web/boyermoore';

// reference: all start indices where pattern occurs (overlaps included)
const allIndices = (text: string, pat: string) => {
  const out: number[] = [];
  for (let i = 0; i + pat.length <= text.length; i++) if (text.slice(i, i + pat.length) === pat) out.push(i);
  return out;
};

describe('the bad-character table', () => {
  it('records the last index of each pattern character', () => {
    expect(lastOccurrence('ABCAB')).toEqual({ A: 3, B: 4, C: 2 });
  });
});

describe('correctness — finds exactly the same matches as a naive scan', () => {
  for (const [text, pat] of [
    ['HERE IS A SIMPLE EXAMPLE', 'EXAMPLE'],
    ['aaaaa', 'aa'],
    ['abracadabra', 'abr'],
    ['mississippi', 'issi'],
    ['ABCDEF', 'XYZ'],
  ] as const) {
    it(`"${pat}" in "${text}"`, () => {
      expect(search(text, pat).matches).toEqual(allIndices(text, pat));
    });
  }
  it('the classic example matches at index 17', () => {
    expect(search('HERE IS A SIMPLE EXAMPLE', 'EXAMPLE').matches).toEqual([17]);
  });
  it('overlapping matches are all reported', () => {
    expect(search('aaaaa', 'aa').matches).toEqual([0, 1, 2, 3]);
  });
});

describe('skipping — characters absent from the pattern cause big jumps', () => {
  it('a pattern of characters not in the text is rejected in a handful of comparisons', () => {
    const r = search('ABCDEFGHIJKL', 'XYZ'); // none of X,Y,Z occur → leap by 3 each time
    expect(r.matches).toEqual([]);
    expect(r.comparisons).toBeLessThan('ABCDEFGHIJKL'.length); // far fewer than inspecting every char
  });
  it('does fewer comparisons than the naive scan on a favourable input', () => {
    const text = 'the quick brown fox jumps over the lazy dog and runs away quickly';
    expect(search(text, 'quickly').comparisons).toBeLessThan(naiveComparisons(text, 'quickly'));
  });
  it('records a shift for every alignment it tries', () => {
    const r = search('ABCDEF', 'XYZ');
    expect(r.steps.every((s) => s.shift >= 1)).toBe(true); // never stalls
  });
});
