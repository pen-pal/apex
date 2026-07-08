import { describe, it, expect } from 'vitest';
import { encode, ratio } from '../src/web/columnar';

// Independent oracle: columnar encoding sizes computed by hand. For ['a','a','b','b','b','c']: 6 rows, 3 distinct →
// code width ceil(log2 3)=2 bits; coded = ceil(6·2/8)=2 bytes; dictionary = 1+1+1=3 bytes; 3 runs (aa,bbb,c) → RLE =
// 3·(1+2)=9 bytes. Plus the comparative properties that motivate columnar layout: a sorted low-cardinality column
// compresses far below raw, while unique IDs defeat the dictionary (it grows as large as the data).

describe('encode — exact sizes on a hand example', () => {
  const e = encode(['a', 'a', 'b', 'b', 'b', 'c']);
  it('counts rows, distinct values, and code width', () => {
    expect(e.n).toBe(6);
    expect(e.distinct).toBe(3);
    expect(e.codeBits).toBe(2);          // ceil(log2 3)
  });
  it('bit-packs the codes and stores each distinct value once', () => {
    expect(e.codedBytes).toBe(2);        // ceil(6*2/8)
    expect(e.dictBytes).toBe(3);         // 'a'+'b'+'c'
    expect(e.dictTotal).toBe(5);
  });
  it('counts maximal equal-adjacent runs for RLE', () => {
    expect(e.runs).toBe(3);              // aa | bbb | c
    expect(e.rleBytes).toBe(9);          // 3*(1+2)
    expect(e.rleTotal).toBe(12);
  });
});

describe('a single-value column collapses', () => {
  const e = encode(['x', 'x', 'x', 'x']);
  it('is one distinct value, one run, one code bit', () => {
    expect(e.distinct).toBe(1);
    expect(e.codeBits).toBe(1);
    expect(e.runs).toBe(1);
  });
});

describe('the properties that make analytics column-oriented', () => {
  const col = (parts: [string, number][]) => parts.flatMap(([v, k]) => Array(k).fill(v));
  it('a sorted low-cardinality column compresses far below raw', () => {
    const sorted = col([['US', 300], ['UK', 300], ['FR', 400]]); // 1000 rows, 3 distinct, 3 runs
    const e = encode(sorted);
    expect(e.runs).toBe(3);
    expect(ratio(e.raw, e.rleTotal)).toBeGreaterThan(50); // dict+RLE crushes it
  });
  it('shuffling keeps the dictionary win but destroys RLE', () => {
    const clustered = encode(col([['US', 500], ['UK', 500]]));
    const shuffled = encode(Array.from({ length: 1000 }, (_, i) => (i % 2 ? 'US' : 'UK'))); // alternating
    expect(shuffled.runs).toBeGreaterThan(clustered.runs);        // every value its own run
    expect(shuffled.rleTotal).toBeGreaterThan(clustered.rleTotal);
  });
  it('unique IDs defeat the dictionary — it grows as large as the data', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `id${String(i).padStart(4, '0')}`); // all distinct
    const e = encode(ids);
    expect(e.distinct).toBe(500);
    expect(e.dictBytes).toBeGreaterThanOrEqual(e.raw);            // dictionary stores every value once = all of it
  });
});
