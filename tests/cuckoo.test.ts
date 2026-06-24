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
  it('a key landing on an occupied slot kicks the occupant to its other slot', () => {
    // force a collision: put two keys whose first slot coincides
    const c = create(11);
    // find two distinct keys that share their primary slot
    let a = '', b = '';
    for (let i = 0; i < 1000 && !b; i++) {
      const k = 'k' + i;
      const s = slots(c, k)[0];
      if (!a) { a = k; }
      else if (slots(c, a)[0] === s && k !== a) { b = k; }
    }
    insert(c, a);
    const r = insert(c, b); // b wants a's slot → a gets kicked to its alternate
    expect(r.ok).toBe(true);
    expect(r.evictions.length).toBeGreaterThanOrEqual(1);
    expect(lookup(c, a).found).toBe(true); // both still present
    expect(lookup(c, b).found).toBe(true);
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
