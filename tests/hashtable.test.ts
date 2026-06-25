import { describe, it, expect } from 'vitest';
import { createChained, chainInsert, chainLookup, chainRemove, createProbed, probeInsert, probeLookup, probeRemove, loadFactor, slotOf } from '../src/web/hashtable';

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

  it('a key lands in the bucket its hash selects (externally-anchored slots)', () => {
    // FNV-1a(key) mod 8, computed independently: 'apple'→7, 'a'→4
    expect(slotOf('apple', 8)).toBe(7);
    expect(slotOf('a', 8)).toBe(4);
    const t = createChained(8);
    const r = chainInsert(t, 'apple');
    expect(r.slot).toBe(7);
    expect(t.buckets[7]).toContain('apple');
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

  it('genuinely colliding keys probe forward and wrap around', () => {
    // independently verified: 'one' and 'three' both hash to slot 3 in a size-4 table
    expect(slotOf('one', 4)).toBe(3);
    expect(slotOf('three', 4)).toBe(3);
    const t = createProbed(4);
    expect(probeInsert(t, 'one').slot).toBe(3);           // takes its home slot
    const r = probeInsert(t, 'three');                    // collides → probe forward, wrapping 3→0
    expect(r.probeSeq).toEqual([3, 0]);
    expect(r.slot).toBe(0);
    expect(probeLookup(t, 'three').probes).toBe(2);       // lookup re-walks the same path
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

describe('deletion', () => {
  // find two keys that hash to the same start slot (a real collision → probe chain)
  function collidingPair(m: number): [string, string] {
    const bySlot: Record<number, string[]> = {};
    for (let i = 0; i < 500; i++) { const k = 'item' + i; const s = slotOf(k, m); (bySlot[s] ??= []).push(k); if (bySlot[s].length === 2) return [bySlot[s][0], bySlot[s][1]]; }
    throw new Error('no collision found');
  }

  it('chaining: delete splices from the bucket, leaving collision neighbours intact', () => {
    const m = 4;
    const t = createChained(m);
    const [a, b] = collidingPair(m); // a and b share a bucket
    chainInsert(t, a); chainInsert(t, b);
    expect(chainRemove(t, a)).toBe(true);
    expect(chainLookup(t, a).found).toBe(false);
    expect(chainLookup(t, b).found).toBe(true); // its bucket-mate is unaffected
    expect(chainRemove(t, 'absent')).toBe(false);
  });

  it('open addressing: a tombstone keeps a probe chain walkable (no orphaned key)', () => {
    const m = 8;
    const t = createProbed(m);
    const [a, b] = collidingPair(m); // b must probe PAST a's slot
    probeInsert(t, a); probeInsert(t, b);
    expect(probeLookup(t, a).found).toBe(true);
    expect(probeLookup(t, b).found).toBe(true);
    expect(probeRemove(t, a)).toBe(true); // tombstone, NOT null
    expect(probeLookup(t, a).found).toBe(false); // a is gone
    expect(probeLookup(t, b).found).toBe(true); // b is STILL findable — the chain wasn't broken (the bug a null would cause)
  });

  it('open addressing: a later insert reuses a tombstoned slot', () => {
    const m = 8;
    const t = createProbed(m);
    const [a, b] = collidingPair(m);
    probeInsert(t, a); probeInsert(t, b);
    probeRemove(t, a);
    const r = probeInsert(t, 'fresh');
    expect(r.ok).toBe(true);
    expect(probeLookup(t, 'fresh').found).toBe(true);
    expect(probeLookup(t, b).found).toBe(true); // existing chain still intact
  });
});
