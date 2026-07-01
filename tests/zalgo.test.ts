import { describe, it, expect } from 'vitest';
import { zArray, search } from '../src/web/zalgo';

// brute-force ground truth
function brute(text: string, pattern: string): number[] {
  const t = [...text], p = [...pattern], out: number[] = [];
  if (!p.length) return out;
  for (let i = 0; i + p.length <= t.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (t[i + j] !== p[j]) { ok = false; break; }
    if (ok) out.push(i);
  }
  return out;
}

describe('the Z-array', () => {
  it('runs of a repeated char count down', () => {
    expect(zArray('aaaaa')).toEqual([0, 4, 3, 2, 1]); // each suffix matches the prefix, one shorter
  });
  it('a periodic string exposes its period', () => {
    expect(zArray('ababab')).toEqual([0, 0, 4, 0, 2, 0]); // z[2]=4, z[4]=2 — the "abab"/"ab" prefixes
  });
  it('z[0] is 0 by convention; distinct chars give all zeros', () => {
    expect(zArray('abcde')).toEqual([0, 0, 0, 0, 0]);
    expect(zArray('')).toEqual([]);
    expect(zArray('x')).toEqual([0]);
  });
  it('z[i] never runs past the end of the string', () => {
    const z = zArray('aabaaab');
    z.forEach((v, i) => expect(i + v).toBeLessThanOrEqual(7));
  });
});

describe('pattern search (Z over "pattern·text")', () => {
  it('finds overlapping occurrences', () => {
    expect(search('aaaa', 'aa')).toEqual([0, 1, 2]);
    expect(search('ababab', 'aba')).toEqual([0, 2]);
  });
  it('classic multi-hit example', () => {
    expect(search('aabxaabxcaabxaabxay', 'aabx')).toEqual([0, 4, 9, 13]);
  });
  it('empty pattern → no matches; absent pattern → none', () => {
    expect(search('abc', '')).toEqual([]);
    expect(search('abc', 'xyz')).toEqual([]);
  });
  it('agrees with brute force over many random strings', () => {
    const AB = 'abcab';
    let s = 12345; const r = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let t = 0; t < 3000; t++) {
      const tl = 1 + Math.floor(r() * 16), pl = 1 + Math.floor(r() * 5);
      const T = Array.from({ length: tl }, () => AB[Math.floor(r() * AB.length)]).join('');
      const P = Array.from({ length: pl }, () => AB[Math.floor(r() * AB.length)]).join('');
      expect(search(T, P)).toEqual(brute(T, P));
    }
  });
});

describe('emoji-safe (code points, not UTF-16 units)', () => {
  it('zArray counts code points', () => {
    expect(zArray('😀😀😀')).toEqual([0, 2, 1]);
  });
  it('search returns code-point indices', () => {
    expect(search('a😀b😀b', '😀b')).toEqual([1, 3]);
  });
});
