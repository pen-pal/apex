import { describe, it, expect } from 'vitest';
import { manacher } from '../src/web/manacher';

// Independent O(n^2) reference: expand around every center, take the longest.
function brute(s: string): string {
  let best = '';
  const grow = (l: number, r: number) => { while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; } return s.slice(l + 1, r); };
  for (let i = 0; i < s.length; i++) {
    for (const cand of [grow(i, i), grow(i, i + 1)]) if (cand.length > best.length) best = cand;
  }
  return best;
}

describe('Manacher — longest palindromic substring', () => {
  it('odd-length palindromes', () => {
    expect(manacher('babad').longest).toBe('bab'); // first 3-length center scanned
    expect(manacher('racecar')).toMatchObject({ longest: 'racecar', start: 0, length: 7 });
  });
  it('even-length palindromes (the # trick handles them)', () => {
    expect(manacher('cbbd')).toMatchObject({ longest: 'bb', start: 1, length: 2 });
    expect(manacher('abccba')).toMatchObject({ longest: 'abccba', length: 6 });
  });
  it('a palindrome embedded in noise', () => {
    expect(manacher('forgeeksskeegfor')).toMatchObject({ longest: 'geeksskeeg', length: 10 });
  });
  it('degenerate inputs', () => {
    expect(manacher('')).toMatchObject({ longest: '', length: 0 });
    expect(manacher('a')).toMatchObject({ longest: 'a', length: 1 });
    expect(manacher('abcde').length).toBe(1); // no repeats → any single char
  });
  it('all-same characters → the whole string', () => {
    expect(manacher('aaaa')).toMatchObject({ longest: 'aaaa', length: 4 });
  });

  it('handles non-BMP characters (emoji) by code point, not UTF-16 unit', () => {
    expect(manacher('🙂a🙂')).toMatchObject({ longest: '🙂a🙂', length: 3 });
    expect(manacher('x🙂🙂x')).toMatchObject({ longest: 'x🙂🙂x', length: 4 });
  });

  it('treats a literal separator character in the input as an ordinary char', () => {
    expect(manacher('a#a')).toMatchObject({ longest: 'a#a', length: 3 });
  });

  it('the recovered substring is actually a palindrome and matches the brute-force length', () => {
    for (const s of ['babad', 'cbbd', 'forgeeksskeegfor', 'abacdfgdcaba', 'aaaaabaaaaa', 'banana', 'noon', 'xyzzyx']) {
      const m = manacher(s);
      expect(m.longest).toBe([...m.longest].reverse().join('')); // is a palindrome
      expect(m.length).toBe(brute(s).length);                    // optimal length
      expect(s).toContain(m.longest);                            // really a substring
    }
  });

  it('stays linear: extension comparisons are bounded by the transformed length', () => {
    const s = 'a'.repeat(200);
    const m = manacher(s);
    expect(m.comparisons).toBeLessThanOrEqual(m.transformed.length); // O(n), not O(n^2)
    expect(m.longest).toBe(s);
  });
});
