import { describe, it, expect } from 'vitest';
import { apply, transform, converges, naive, type Op } from '../src/web/optransform';

const ins = (pos: number, ch: string, site: number): Op => ({ type: 'ins', pos, ch, site });
const del = (pos: number, site: number): Op => ({ type: 'del', pos, site });

describe('apply', () => {
  it('inserts and deletes characters at positions', () => {
    expect(apply('abc', ins(1, 'X', 0))).toBe('aXbc');
    expect(apply('abc', del(1, 0))).toBe('ac');
    expect(apply('abc', { type: 'noop' })).toBe('abc');
  });
});

describe('the classic concurrent-edit cases converge', () => {
  it('insert vs delete', () => {
    const r = converges('abc', ins(1, 'X', 0), del(1, 1));
    expect(r.ok).toBe(true);
    expect(r.left).toBe('aXc');
  });
  it('insert vs insert at the same spot (site id breaks the tie deterministically)', () => {
    const r = converges('abc', ins(1, 'X', 0), ins(1, 'Y', 1));
    expect(r.ok).toBe(true);
    expect(r.left).toBe('aXYbc'); // lower site id goes left
  });
  it('delete vs delete of the same character (one becomes a no-op)', () => {
    const r = converges('abc', del(1, 0), del(1, 1));
    expect(r.ok).toBe(true);
    expect(r.left).toBe('ac');
    expect(transform(del(1, 1), del(1, 0)).type).toBe('noop');
  });
});

describe('TP1 convergence holds for every concurrent op pair', () => {
  it('20k random (doc, a, b) triples converge under transform()', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const chars = 'XYZ';
    for (let t = 0; t < 20000; t++) {
      let doc = ''; const L = 1 + rnd(6);
      for (let i = 0; i < L; i++) doc += String.fromCharCode(97 + rnd(5));
      const mk = (site: number): Op => (rnd(2) === 0 || doc.length === 0
        ? ins(rnd(doc.length + 1), chars[rnd(3)], site)
        : del(rnd(doc.length), site));
      expect(converges(doc, mk(0), mk(1)).ok).toBe(true);
    }
  });
});

describe('why OT is needed: the naive approach diverges', () => {
  it('applying concurrent ops without transforming disagrees', () => {
    // insert vs delete without transform: the two orders give different strings
    const n = naive('abc', ins(2, 'X', 0), del(0, 1));
    expect(n.ok).toBe(false);
    // OT fixes exactly this
    expect(converges('abc', ins(2, 'X', 0), del(0, 1)).ok).toBe(true);
  });
});
