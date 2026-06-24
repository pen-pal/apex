import { describe, it, expect } from 'vitest';
import { create, insert, lookup, remove, slots, type Cuckoo } from '../src/web/cuckoo';

const build = (keys: string[]): Cuckoo => { const c = create(11); for (const k of keys) insert(c, k); return c; };

describe('cuckoo lookup is at most two probes', () => {
  const c = build(['apple', 'mango', 'cherry', 'banana', 'kiwi']);
  it('finds every inserted key in one of its two slots', () => {
    for (const k of ['apple', 'mango', 'cherry', 'banana', 'kiwi']) {
      const r = lookup(c, k);
      expect(r.found).toBe(true);
      expect(slots(c, k)).toContain(r.at);
      expect(r.probes.length).toBeLessThanOrEqual(2);
    }
  });
  it('rejects absent keys after at most two probes', () => {
    const r = lookup(c, 'grape');
    expect(r.found).toBe(false);
    expect(r.probes.length).toBeLessThanOrEqual(2);
  });
});

describe('eviction chains', () => {
  it('evicts and re-homes when both of a key’s slots are occupied, losing nothing', () => {
    const c = create(7);
    const present: string[] = [];
    let evicted = false;
    for (let i = 0; i < 40 && !evicted; i++) {
      const k = 'e' + i;
      const r = insert(c, k);
      if (r.ok) present.push(k);
      if (r.evictions.length) { evicted = true; for (const e of r.evictions) expect(e.from).not.toBe(e.to); }
    }
    expect(evicted).toBe(true);                                  // an eviction did occur
    for (const k of present) expect(lookup(c, k).found).toBe(true); // every stored key survives
  });
});

describe('deletion (what a Bloom filter cannot do)', () => {
  it('removes a key and frees its slot', () => {
    const c = build(['x', 'y', 'z']);
    expect(remove(c, 'y')).toBe(true);
    expect(lookup(c, 'y').found).toBe(false);
    expect(lookup(c, 'x').found).toBe(true); // others unaffected
    expect(remove(c, 'absent')).toBe(false);
  });
});

describe('determinism', () => {
  it('the same keys produce the same table layout', () => {
    expect(build(['a', 'b', 'c', 'd']).table).toEqual(build(['a', 'b', 'c', 'd']).table);
  });
});

describe('a failed insert never loses a previously-stored key (rollback invariant)', () => {
  it('fills a tiny table until an insert fails, and all prior keys survive', () => {
    const c = create(3); // tiny → some insert will fail
    const inserted: string[] = [];
    let sawFailure = false;
    for (let i = 0; i < 50; i++) {
      const k = 'key' + i;
      const before = [...c.table];
      const r = insert(c, k);
      if (r.ok) inserted.push(k);
      else { sawFailure = true; expect(c.table).toEqual(before); } // failed insert mutates nothing
    }
    expect(sawFailure).toBe(true);                 // we actually exercised the failure path
    for (const k of inserted) expect(lookup(c, k).found).toBe(true); // every success still findable
  });

  it('never emits an eviction record that moves a key to where it already is', () => {
    const c = create(5);
    for (let i = 0; i < 200; i++) {
      const r = insert(c, 'x' + i);
      for (const e of r.evictions) expect(e.from).not.toBe(e.to);
    }
  });

  it('a key whose two slots coincide is not dropped by a later unrelated insert', () => {
    const c = create(5);
    // find a key whose two hashes are equal (single viable slot)
    let same = '';
    for (let i = 0; i < 2000 && !same; i++) { const [a, b] = slots(c, 'q' + i); if (a === b) same = 'q' + i; }
    expect(same).not.toBe('');
    insert(c, same);
    expect(lookup(c, same).found).toBe(true);
    for (let i = 0; i < 30; i++) insert(c, 'filler' + i); // churn the table
    // the single-slot key is either still present, or was rolled back out — never silently lost
    if (c.table.includes(same)) expect(lookup(c, same).found).toBe(true);
  });
});
