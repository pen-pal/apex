import { describe, it, expect } from 'vitest';
import { Roaring } from '../src/web/roaring';

// deterministic PRNG (no Math.random)
function prng(seed: number) { let s = seed; return (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; }; }
const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b);

describe('a Roaring bitmap behaves exactly like a Set of integers', () => {
  it('membership and cardinality match a plain Set over random keys', () => {
    const r = prng(1);
    const set = new Set<number>();
    const rb = new Roaring();
    for (let i = 0; i < 5000; i++) { const k = r(300000); set.add(k); rb.add(k); }
    expect(rb.toArray()).toEqual(sorted(set));
    expect(rb.cardinality()).toBe(set.size);
  });
  it('has() agrees with the Set, present and absent', () => {
    const rb = Roaring.from([5, 70000, 70001, 1000000]);
    for (const k of [5, 70000, 70001, 1000000]) expect(rb.has(k)).toBe(true);
    for (const k of [0, 4, 6, 69999, 999999]) expect(rb.has(k)).toBe(false);
  });
  it('adding a duplicate is a no-op', () => {
    const rb = new Roaring();
    rb.add(42); rb.add(42); rb.add(42);
    expect(rb.cardinality()).toBe(1);
  });
});

describe('set operations match Set union / intersection', () => {
  it('OR and AND agree with the ground truth', () => {
    const r = prng(7);
    const A = new Set<number>(), B = new Set<number>();
    for (let i = 0; i < 3000; i++) { A.add(r(150000)); B.add(r(150000)); }
    const rA = Roaring.from([...A]), rB = Roaring.from([...B]);
    const orSet = new Set([...A, ...B]);
    const andSet = new Set([...A].filter((x) => B.has(x)));
    expect(Roaring.or(rA, rB).toArray()).toEqual(sorted(orSet));
    expect(Roaring.and(rA, rB).toArray()).toEqual(sorted(andSet));
  });
  it('AND of disjoint sets is empty; OR of disjoint sets is the sum', () => {
    const a = Roaring.from([1, 2, 3]), b = Roaring.from([100000, 200000]);
    expect(Roaring.and(a, b).cardinality()).toBe(0);
    expect(Roaring.or(a, b).cardinality()).toBe(5);
  });
});

describe('containers adapt to density (the whole point)', () => {
  it('a sparse chunk stays an array; a dense chunk becomes a bitmap', () => {
    const rb = new Roaring();
    for (let i = 0; i < 10000; i++) rb.add(i);   // chunk 0: >4096 values → bitmap
    rb.add(5_000_000);                            // a lone value in another chunk → array
    const cs = rb.containers();
    const dense = cs.find((c) => c.chunk === 0)!;
    const sparse = cs.find((c) => c.chunk !== 0)!;
    expect(dense.kind).toBe('bitmap');
    expect(dense.bytes).toBe(8192);               // flat 8 KB regardless of count
    expect(sparse.kind).toBe('array');
    expect(sparse.bytes).toBe(2);                 // one uint16
  });
  it('conversion to bitmap preserves the exact set', () => {
    const rb = new Roaring();
    const expected: number[] = [];
    for (let i = 0; i < 5000; i++) { rb.add(i * 2); expected.push(i * 2); } // 5000 values in chunk 0 → bitmap
    expect(rb.containers()[0].kind).toBe('bitmap');
    expect(rb.toArray()).toEqual(expected);
    expect(rb.cardinality()).toBe(5000);
  });
});
