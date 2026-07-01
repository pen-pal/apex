import { describe, it, expect } from 'vitest';
import { GapBuffer } from '../src/web/gapbuffer';

describe('gap buffer basics', () => {
  it('inserts, deletes, and reconstructs the text', () => {
    const g = new GapBuffer('Hello world');
    expect(g.text()).toBe('Hello world');
    g.insert('!'); expect(g.text()).toBe('Hello world!');
    g.moveTo(5); g.insert(','); expect(g.text()).toBe('Hello, world!');
  });
  it('backspace and delete-forward', () => {
    const g = new GapBuffer('abcdef');
    g.moveTo(3); g.deleteBack(); expect(g.text()).toBe('abdef');
    g.deleteForward(); expect(g.text()).toBe('abef');
  });
  it('grows when the gap fills, staying correct', () => {
    const g = new GapBuffer('', 2);
    for (const c of 'abcdefghij') g.insert(c);
    expect(g.text()).toBe('abcdefghij');
  });
});

describe('the cost model: local edits O(1), cursor moves O(distance)', () => {
  it('a local insert shifts nothing; a far cursor jump shifts ~distance characters', () => {
    const g = new GapBuffer('a'.repeat(100));
    const before = g.shifts; g.insert('X'); expect(g.shifts - before).toBe(0); // O(1) into the gap
    g.moveTo(0); expect(g.shifts).toBe(101); // slid the gap across 101 chars
  });
});

describe('regression + fuzz', () => {
  it('moving the cursor across an EMPTY gap (right after an insert fills it) must not drop a char', () => {
    const g = new GapBuffer('ab', 1);
    g.moveTo(2); g.insert('c'); // fills the size-1 gap → gap becomes empty
    g.moveTo(0); g.insert('Z');
    expect(g.text()).toBe('Zabc');
  });
  it('20000 random edit sequences match a reference string', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let run = 0; run < 20000; run++) {
      let str = 'xyz'; const g = new GapBuffer('xyz', 1 + rnd(4));
      for (let o = 0; o < 1 + rnd(15); o++) {
        const len = str.length, op = rnd(4);
        if (op === 0) { const p = rnd(len + 1); g.moveTo(p); const ch = String.fromCharCode(97 + rnd(6)); g.insert(ch); str = str.slice(0, p) + ch + str.slice(p); }
        else if (op === 1 && len > 0) { const p = 1 + rnd(len); g.moveTo(p); g.deleteBack(); str = str.slice(0, p - 1) + str.slice(p); }
        else if (op === 2 && len > 0) { const p = rnd(len); g.moveTo(p); g.deleteForward(); str = str.slice(0, p) + str.slice(p + 1); }
        else { g.moveTo(rnd(len + 1)); }
      }
      expect(g.text()).toBe(str);
      expect(g.length()).toBe(str.length);
    }
  });
});
