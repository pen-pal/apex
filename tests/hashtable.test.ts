import { describe, it, expect } from 'vitest';
import { createChained, chainInsert, chainLookup, createProbed, probeInsert, probeLookup, loadFactor, slotOf } from '../src/web/hashtable';

describe('separate chaining', () => {
  it('colliding keys share a bucket and are all findable', () => {
    const t = createChained(8);
    const keys = ['apple', 'mango', 'cherry', 'banana', 'kiwi', 'plum', 'fig', 'date'];
    for (const k of keys) chainInsert(t, k);
    for (const k of keys) expect(chainLookup(t, k).found).toBe(true);
    expect(chainLookup(t, 'grape').found).toBe(false);
    // total stored across buckets equals the number of keys (none lost to collisions)
    expect(t.buckets.reduce((s, b) => s + b.length, 0)).toBe(keys.length);
  });

  it('a key lands in the bucket its hash selects', () => {
    const t = createChained(8);
    const r = chainInsert(t, 'apple');
    expect(r.slot).toBe(slotOf('apple', 8));
    expect(t.buckets[r.slot]).toContain('apple');
  });
});

describe('open addressing (linear probing)', () => {
  it('a collision probes forward to the next free slot', () => {
    const t = createProbed(8);
    // insert several keys; every one is findable and lands in a distinct slot
    const keys = ['a', 'b', 'c', 'd', 'e'];
    const slots = keys.map((k) => probeInsert(t, k).slot);
    expect(new Set(slots).size).toBe(keys.length); // no two keys in the same slot
    for (const k of keys) expect(probeLookup(t, k).found).toBe(true);
  });

  it('probe sequence starts at the hash slot and walks forward', () => {
    const t = createProbed(8);
    const first = probeInsert(t, 'x');
    expect(first.probeSeq[0]).toBe(slotOf('x', 8));
    expect(first.slot).toBe(slotOf('x', 8)); // empty table → lands on its hash slot
  });

  it('reports not-found by hitting an empty slot, and computes load factor', () => {
    const t = createProbed(4);
    probeInsert(t, 'one'); probeInsert(t, 'two');
    expect(probeLookup(t, 'three').found).toBe(false);
    expect(loadFactor(t)).toBe(0.5); // 2 of 4 filled
  });

  it('fails to insert into a full table', () => {
    const t = createProbed(3);
    expect(probeInsert(t, 'a').ok).toBe(true);
    expect(probeInsert(t, 'b').ok).toBe(true);
    expect(probeInsert(t, 'c').ok).toBe(true);
    const full = probeInsert(t, 'd');
    expect(full.ok).toBe(false); // no free slot
  });
});
