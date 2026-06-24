import { describe, it, expect } from 'vitest';
import { search, naiveSearch, roll, windowHash, BASE, PRIME } from '../src/web/rabinkarp';

describe('rolling hash', () => {
  it('the rolled hash equals a fresh hash of the new window', () => {
    const h1 = windowHash('abc');        // window [0..2]
    const rolled = roll(h1, 'a', 'd', 3); // slide to [1..3] = "bcd"
    expect(rolled).toBe(windowHash('bcd'));
    expect(roll(rolled, 'b', 'e', 3)).toBe(windowHash('cde'));
  });

  it('a fresh window hash is the base-256 polynomial mod the prime', () => {
    // "ab" = (97*256 + 98) mod PRIME
    expect(windowHash('ab')).toBe((97 * BASE + 98) % PRIME);
  });
});

describe('search finds the right positions', () => {
  it('matches a pattern, including overlaps', () => {
    expect(search('abracadabra', 'abra').matches).toEqual([0, 7]);
    expect(search('aaaaa', 'aa').matches).toEqual([0, 1, 2, 3]);
    expect(search('hello world', 'o').matches).toEqual([4, 7]);
  });
  it('reports no match', () => {
    expect(search('abcdef', 'xyz').matches).toEqual([]);
  });
});

describe('agrees with the naive matcher (cross-check)', () => {
  for (const [t, p] of [['abracadabra', 'abra'], ['mississippi', 'issi'], ['the rain in spain', 'in'], ['xxxxxx', 'xx'], ['abcabcabc', 'cab']] as [string, string][])
    it(`"${p}" in "${t}"`, () => expect(search(t, p).matches).toEqual(naiveSearch(t, p)));
});

describe('hash matches are verified to avoid collisions', () => {
  it('every reported match is a real substring (no false positive survives)', () => {
    const r = search('abracadabra', 'abra');
    for (const m of r.matches) expect('abracadabra'.substr(m, 4)).toBe('abra');
    expect(r.falsePositives).toBe(0); // none for this small case
    expect(r.hashHits).toBeGreaterThanOrEqual(r.matches.length); // a hit per match, plus any collisions
  });
});
