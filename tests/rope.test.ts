import { describe, it, expect } from 'vitest';
import { leaf, concat, index, split, insert, del, toStr, length, fromChunks } from '../src/web/rope';

describe('rope basics', () => {
  const r = fromChunks(['Hello_', 'beautiful_', 'world']);
  it('reconstructs the string and reports its length', () => {
    expect(toStr(r)).toBe('Hello_beautiful_world');
    expect(length(r)).toBe(21);
  });
  it('index walks the weights to the right character', () => {
    const s = toStr(r);
    for (let i = 0; i < s.length; i++) expect(index(r, i)).toBe(s[i]);
  });
  it('split cuts cleanly and the halves rejoin to the original', () => {
    const [a, b] = split(r, 6);
    expect(toStr(a)).toBe('Hello_');
    expect(toStr(b)).toBe('beautiful_world');
    expect(toStr(concat(a, b))).toBe(toStr(r));
  });
});

describe('edits match string operations and are immutable (persistent)', () => {
  it('insert and delete', () => {
    const r = fromChunks(['Hello_', 'beautiful_', 'world']);
    expect(toStr(insert(r, 6, 'very_'))).toBe('Hello_very_beautiful_world');
    expect(toStr(del(r, 6, 16))).toBe('Hello_world');
    expect(toStr(r)).toBe('Hello_beautiful_world'); // original untouched → free undo
  });
  it('empty rope and inserting into it', () => {
    expect(toStr(fromChunks([]))).toBe('');
    expect(toStr(insert(leaf(''), 0, 'hi'))).toBe('hi');
  });
});

describe('agrees with a reference string over random edit sequences (fuzz)', () => {
  it('20000 runs of random inserts/deletes, checking full string + every index', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let run = 0; run < 20000; run++) {
      let str = 'abc';
      let rope = fromChunks(['a', 'b', 'c']);
      for (let o = 0; o < 1 + rnd(12); o++) {
        const len = str.length;
        if (rnd(2) === 0 || len === 0) {
          const i = rnd(len + 1), ch = String.fromCharCode(97 + rnd(6));
          rope = insert(rope, i, ch); str = str.slice(0, i) + ch + str.slice(i);
        } else {
          const i = rnd(len), j = i + 1 + rnd(len - i);
          rope = del(rope, i, j); str = str.slice(0, i) + str.slice(j);
        }
      }
      expect(toStr(rope)).toBe(str);
      for (let i = 0; i < str.length; i++) expect(index(rope, i)).toBe(str[i]);
    }
  });
});
