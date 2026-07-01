import { describe, it, expect } from 'vitest';
import { PieceTable } from '../src/web/piecetable';

describe('editing produces the right text', () => {
  it('insert splices text at a position', () => {
    const pt = new PieceTable('the fox');
    pt.insert(4, 'quick brown ');
    expect(pt.getText()).toBe('the quick brown fox');
  });
  it('delete removes a range, even across piece boundaries', () => {
    const pt = new PieceTable('the fox');
    pt.insert(4, 'quick brown ');   // "the quick brown fox"
    pt.delete(0, 4);                // remove "the "
    expect(pt.getText()).toBe('quick brown fox');
  });
  it('inserts at the very start and very end', () => {
    const pt = new PieceTable('AB');
    pt.insert(2, 'C');              // append
    pt.insert(0, 'Z');              // prepend
    expect(pt.getText()).toBe('ZABC');
  });
  it('clamps out-of-range positions/counts instead of corrupting', () => {
    const pt = new PieceTable('hello');
    pt.insert(999, '!');            // past the end → append
    expect(pt.getText()).toBe('hello!');
    pt.delete(3, 999);              // over-long delete → to the end
    expect(pt.getText()).toBe('hel');
  });
});

describe('the buffers are immutable and append-only', () => {
  it('never mutates the original buffer; typed text only grows the add buffer', () => {
    const pt = new PieceTable('the fox');
    pt.insert(4, 'quick ');
    pt.delete(0, 4);
    expect(pt.orig).toBe('the fox');       // original untouched
    expect(pt.add).toBe('quick ');         // add buffer holds only inserted text
    // deleting does not shrink the add buffer — the bytes stay, only descriptors change
    const addLenBefore = pt.add.length;
    pt.delete(0, 2);
    expect(pt.add.length).toBe(addLenBefore);
  });
  it('a fresh table is a single piece over the original', () => {
    const pt = new PieceTable('hello');
    expect(pt.pieces).toEqual([{ buffer: 'orig', start: 0, len: 5 }]);
    expect(pt.length).toBe(5);
  });
});

describe('agrees with a plain-string reference under random edits', () => {
  it('5000 runs of 20 random insert/delete ops', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const chars = 'abcdefgh';
    for (let t = 0; t < 5000; t++) {
      let ref = Array.from({ length: rnd(8) }, () => chars[rnd(8)]).join('');
      const pt = new PieceTable(ref);
      for (let op = 0; op < 20; op++) {
        if (rnd(2) === 0 || ref.length === 0) {
          const pos = rnd(ref.length + 1);
          const txt = Array.from({ length: 1 + rnd(4) }, () => chars[rnd(8)]).join('');
          pt.insert(pos, txt); ref = ref.slice(0, pos) + txt + ref.slice(pos);
        } else {
          const pos = rnd(ref.length);
          const cnt = 1 + rnd(ref.length - pos);
          pt.delete(pos, cnt); ref = ref.slice(0, pos) + ref.slice(pos + cnt);
        }
        expect(pt.getText()).toBe(ref);
      }
    }
  });
});
