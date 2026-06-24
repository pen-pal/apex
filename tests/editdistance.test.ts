import { describe, it, expect } from 'vitest';
import { editDistance } from '../src/web/editdistance';

describe('Levenshtein distance (canonical pairs)', () => {
  it('kitten → sitting is 3', () => {
    expect(editDistance('kitten', 'sitting').distance).toBe(3);
  });
  it('saturday → sunday is 3', () => {
    expect(editDistance('saturday', 'sunday').distance).toBe(3);
  });
  it('flaw → lawn is 2', () => {
    expect(editDistance('flaw', 'lawn').distance).toBe(2);
  });
  it('identical strings are 0; empty is the other length', () => {
    expect(editDistance('abc', 'abc').distance).toBe(0);
    expect(editDistance('', 'hello').distance).toBe(5);
    expect(editDistance('hello', '').distance).toBe(5);
    expect(editDistance('', '').distance).toBe(0);
  });
});

describe('the DP table', () => {
  it('is (m+1)×(n+1) with the right borders and corner', () => {
    const r = editDistance('ab', 'abc');
    expect(r.table.length).toBe(3);       // m+1
    expect(r.table[0].length).toBe(4);    // n+1
    expect(r.table[0]).toEqual([0, 1, 2, 3]); // insert border
    expect(r.table.map((row) => row[0])).toEqual([0, 1, 2]); // delete border
    expect(r.table[2][3]).toBe(r.distance);
  });
});

describe('the recovered edits', () => {
  it('reconstruct b from a, and their cost equals the distance', () => {
    for (const [a, b] of [['kitten', 'sitting'], ['saturday', 'sunday'], ['abc', 'abc'], ['', 'xyz'], ['flaw', 'lawn']] as [string, string][]) {
      const r = editDistance(a, b);
      // applying the edits to a yields b
      let out = '';
      for (const e of r.edits) { if (e.op === 'match' || e.op === 'substitute') out += e.b; else if (e.op === 'insert') out += e.b; /* delete adds nothing */ }
      expect(out).toBe(b);
      // number of non-match edits equals the distance
      expect(r.edits.filter((e) => e.op !== 'match').length).toBe(r.distance);
    }
  });
});
