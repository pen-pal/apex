import { describe, it, expect } from 'vitest';
import { fixedChunks, cdcChunks, dedup, type Chunk } from '../src/web/cdc';

const enc = (s: string) => [...new TextEncoder().encode(s)];
const TEXT = 'the quick brown fox jumps over the lazy dog and then keeps running far away into the night';
const OPTS = { minSize: 3, avgSize: 8, maxSize: 24 };

const partitions = (chunks: Chunk[], n: number) => {
  // chunks must tile [0, n) with no gaps or overlaps
  let pos = 0;
  for (const c of chunks) { if (c.start !== pos) return false; pos += c.len; }
  return pos === n;
};

describe('fixed-size chunking', () => {
  it('cuts every N bytes and tiles the whole input', () => {
    const A = enc(TEXT);
    const f = fixedChunks(A, 8);
    expect(f.length).toBe(Math.ceil(A.length / 8));
    expect(partitions(f, A.length)).toBe(true);
  });

  it('is fragile: a one-byte front insert changes every chunk (0% dedup)', () => {
    const a = fixedChunks(enc(TEXT), 8);
    const b = fixedChunks(enc('X' + TEXT), 8);
    expect(dedup(a, b).reused).toBe(0);
  });
});

describe('content-defined chunking', () => {
  it('tiles the whole input with content-placed boundaries', () => {
    const A = enc(TEXT);
    const c = cdcChunks(A, OPTS);
    expect(partitions(c, A.length)).toBe(true);
    expect(c.length).toBeGreaterThan(1);
  });

  it('respects the max-size guard (no runaway chunk)', () => {
    const A = enc(TEXT);
    for (const ch of cdcChunks(A, OPTS)) expect(ch.len).toBeLessThanOrEqual(OPTS.maxSize);
  });

  it('is shift-resistant: a one-byte front insert reuses almost every chunk', () => {
    const a = cdcChunks(enc(TEXT), OPTS);
    const b = cdcChunks(enc('X' + TEXT), OPTS);
    const d = dedup(a, b);
    // CDC's guarantee is that an edit perturbs only O(1) chunks — almost all survive.
    // (For this text it's exactly one; the general bound is a small constant, not chunks-1 always.)
    expect(d.reused).toBeGreaterThanOrEqual(a.length - 2);
    expect(d.reused).toBeGreaterThan(a.length / 2);
    expect(d.bytesReused).toBeGreaterThan(d.bytesTotal * 0.8); // >80% of bytes need not be re-sent
  });

  it('beats fixed chunking by a wide margin on the same edit', () => {
    const fixedReuse = dedup(fixedChunks(enc(TEXT), 8), fixedChunks(enc('X' + TEXT), 8)).reused;
    const cdcReuse = dedup(cdcChunks(enc(TEXT), OPTS), cdcChunks(enc('X' + TEXT), OPTS)).reused;
    expect(cdcReuse).toBeGreaterThan(fixedReuse + 3);
  });

  it('is deterministic — same bytes, same chunks', () => {
    expect(cdcChunks(enc(TEXT), OPTS)).toEqual(cdcChunks(enc(TEXT), OPTS));
  });
});

describe('dedup accounting', () => {
  it('identical inputs reuse everything', () => {
    const c = cdcChunks(enc(TEXT), OPTS);
    const d = dedup(c, c);
    expect(d.reused).toBe(d.total);
    expect(d.bytesReused).toBe(d.bytesTotal);
  });

  it('matches by content hash, not position (a moved chunk still dedupes)', () => {
    // two chunk lists sharing a hash but at different offsets
    const a: Chunk[] = [{ start: 0, len: 4, hash: 111 }, { start: 4, len: 4, hash: 222 }];
    const b: Chunk[] = [{ start: 0, len: 9, hash: 999 }, { start: 9, len: 4, hash: 222 }];
    expect(dedup(a, b).reused).toBe(1); // the hash-222 chunk is reused despite the offset shift
  });
});
