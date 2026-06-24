import { describe, it, expect } from 'vitest';
import { failure, search, naiveSearch } from '../src/web/kmp';

describe('failure function (prefix table)', () => {
  it('hand-worked tables', () => {
    expect(failure('ABABAC')).toEqual([0, 0, 1, 2, 3, 0]);
    expect(failure('AAAA')).toEqual([0, 1, 2, 3]);
    expect(failure('ABCDE')).toEqual([0, 0, 0, 0, 0]);
    expect(failure('AABAACAABAA')).toEqual([0, 1, 0, 1, 2, 0, 1, 2, 3, 4, 5]); // CLRS example
  });
});

describe('search finds the right positions', () => {
  it('matches the classic example', () => {
    expect(search('ABABABACABA', 'ABABAC').matches).toEqual([2]);
  });
  it('finds overlapping occurrences', () => {
    expect(search('AAAAA', 'AA').matches).toEqual([0, 1, 2, 3]);
    expect(search('aabaabaab', 'aab').matches).toEqual([0, 3, 6]);
  });
  it('reports no match cleanly', () => {
    expect(search('hello world', 'xyz').matches).toEqual([]);
  });
});

describe('agrees with the naive matcher (independent cross-check)', () => {
  const cases: [string, string][] = [
    ['ABABABACABA', 'ABABAC'], ['AAAAAA', 'AAA'], ['the rain in spain', 'in'],
    ['mississippi', 'issi'], ['abcabcabc', 'cab'], ['xxxxx', 'y'],
  ];
  for (const [t, p] of cases)
    it(`"${p}" in "${t}"`, () => expect(search(t, p).matches).toEqual(naiveSearch(t, p)));
});

describe('the text pointer never goes backward', () => {
  it('recorded text indices are non-decreasing', () => {
    const steps = search('ababcababcabc', 'ababcabc').steps;
    for (let i = 1; i < steps.length; i++) expect(steps[i].textIndex).toBeGreaterThanOrEqual(steps[i - 1].textIndex);
  });
});
