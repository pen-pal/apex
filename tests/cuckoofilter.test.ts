import { describe, it, expect } from 'vitest';
import { insert, contains, remove, altBucket, fingerprint, empty, load, BUCKETS, SLOTS } from '../src/web/cuckoofilter';

// Independent oracle: the defining properties of a cuckoo filter, not the implementation. The partial-key relocation is
// self-inverse (a fingerprint's two buckets map to each other). An inserted item is always found — never a false
// negative. Delete removes it. The table has a hard capacity (BUCKETS×SLOTS) and inserts start failing before it's
// completely full. These follow from the structure, not from running the code and trusting the output.

describe('the XOR partial-key trick is self-inverse', () => {
  it('altBucket(altBucket(i, f), f) === i for every bucket and fingerprint', () => {
    for (let i = 0; i < BUCKETS; i++) for (const f of [1, 7, 42, 200, 255]) {
      expect(altBucket(altBucket(i, f), f)).toBe(i);
    }
  });
  it('fingerprints are never zero', () => {
    for (const s of ['', 'a', 'hello', 'zzz']) expect(fingerprint(s)).toBeGreaterThan(0);
  });
});

describe('no false negatives', () => {
  it('everything successfully inserted is found', () => {
    let b = empty();
    const inserted: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = insert(b, `item-${i}`);
      if (r.ok) { b = r.buckets; inserted.push(`item-${i}`); }
    }
    expect(inserted.length).toBeGreaterThan(0);
    for (const x of inserted) expect(contains(b, x)).toBe(true);
  });
});

describe('delete — the thing Bloom cannot do', () => {
  it('removes an item and leaves the others', () => {
    let b = empty();
    for (const x of ['apple', 'mango', 'cherry']) b = insert(b, x).buckets;
    expect(contains(b, 'mango')).toBe(true);
    const r = remove(b, 'mango');
    expect(r.removed).toBe(true);
    expect(contains(r.buckets, 'mango')).toBe(false);
    expect(contains(r.buckets, 'apple')).toBe(true);   // untouched
    expect(contains(r.buckets, 'cherry')).toBe(true);
  });
  it('removing something never inserted is a no-op', () => {
    const b = insert(empty(), 'apple').buckets;
    expect(remove(b, 'banana').removed).toBe(false);
  });
});

describe('bounded capacity', () => {
  it('load never exceeds BUCKETS×SLOTS and inserts fail before it fills completely', () => {
    let b = empty();
    let failures = 0;
    for (let i = 0; i < 60; i++) { // far more than the 32-slot capacity
      const r = insert(b, `k${i}`);
      if (r.ok) b = r.buckets; else failures++;
    }
    expect(load(b)).toBeLessThanOrEqual(BUCKETS * SLOTS);
    expect(failures).toBeGreaterThan(0); // some inserts were rejected (table full)
  });
});
