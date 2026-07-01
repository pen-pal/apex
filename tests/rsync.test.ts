import { describe, it, expect } from 'vitest';
import { weak, computeDelta, reconstruct, transferred } from '../src/web/rsync';

const OLD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOP';

describe('the rolling checksum', () => {
  it('an incremental roll equals a from-scratch recompute at every position', () => {
    const s = 'the quick brown fox jumps over the lazy dog then runs';
    const B = 6;
    // roll a/b by hand and compare to weak() at each window
    let a = 0, b = 0; const M = 65536;
    for (let k = 0; k < B; k++) { const x = s.charCodeAt(k); a = (a + x) % M; b = (b + (B - k) * x) % M; }
    for (let i = 0; i + B < s.length; i++) {
      expect((a + M * b) >>> 0).toBe(weak(s, i, B)); // rolling state matches from-scratch
      const out = s.charCodeAt(i), inp = s.charCodeAt(i + B);
      a = ((a - out + inp) % M + M) % M;
      b = ((b - B * out + a) % M + M) % M;
    }
  });
});

describe('delta reconstructs the new file exactly', () => {
  it('identical files → all copies (bar a trailing partial block) and a tiny transfer', () => {
    const d = computeDelta(OLD, OLD, 8);
    expect(reconstruct(OLD, d, 8)).toBe(OLD);
    expect(d.filter((o) => o.type === 'copy').length).toBe(Math.floor(OLD.length / 8)); // every full block copied
    expect(transferred(d)).toBeLessThan(OLD.length);
  });
  it('an inserted run re-syncs: matches the shifted blocks after the edit', () => {
    const next = OLD.slice(0, 20) + 'XXXX' + OLD.slice(20);
    const d = computeDelta(OLD, next, 8);
    expect(reconstruct(OLD, d, 8)).toBe(next);
    expect(d.some((o) => o.type === 'copy')).toBe(true);         // still found matching blocks past the insert
    expect(transferred(d)).toBeLessThan(next.length);
  });
  it('an unrelated file is all literals but still reconstructs', () => {
    const diff = 'z'.repeat(40);
    const d = computeDelta(OLD, diff, 8);
    expect(reconstruct(OLD, d, 8)).toBe(diff);
    expect(d.filter((o) => o.type === 'copy').length).toBe(0);
  });
});

describe('reconstruction is exact under arbitrary edits (fuzz)', () => {
  it('8k random old/new pairs rebuild byte-for-byte', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const ch = 'abcdefgh';
    for (let t = 0; t < 8000; t++) {
      const len = 20 + rnd(80);
      let o = ''; for (let k = 0; k < len; k++) o += ch[rnd(8)];
      let n = o;
      for (let e = 0, m = rnd(5); e < m; e++) {
        const pos = rnd(n.length + 1), op = rnd(3);
        if (op === 0) n = n.slice(0, pos) + ch[rnd(8)] + n.slice(pos);
        else { const p = Math.min(pos, Math.max(0, n.length - 1)); n = op === 1 && n.length > 1 ? n.slice(0, p) + n.slice(p + 1) : n.slice(0, p) + ch[rnd(8)] + n.slice(p + 1); }
      }
      const B = 4 + rnd(6);
      expect(reconstruct(o, computeDelta(o, n, B), B)).toBe(n);
    }
  });
});
