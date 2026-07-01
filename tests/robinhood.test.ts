import { describe, it, expect } from 'vitest';
import { RobinHood, plainLinearProbe } from '../src/web/robinhood';

describe('insert / lookup / delete', () => {
  const keys = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'kiwi', 'lemon', 'mango'];
  it('finds every inserted key and rejects absent ones', () => {
    const t = new RobinHood(16);
    keys.forEach((k) => t.insert(k));
    expect(t.size).toBe(10);
    for (const k of keys) expect(t.lookup(k)).toBeGreaterThanOrEqual(0);
    for (const k of ['xyz', 'nope', 'zzz']) expect(t.lookup(k)).toBe(-1);
  });
  it('backward-shift delete removes the key and keeps the rest findable', () => {
    const t = new RobinHood(16);
    keys.forEach((k) => t.insert(k));
    expect(t.delete('cherry')).toBe(true);
    expect(t.lookup('cherry')).toBe(-1);
    expect(t.size).toBe(9);
    for (const k of keys.filter((x) => x !== 'cherry')) expect(t.lookup(k)).toBeGreaterThanOrEqual(0);
    expect(t.delete('cherry')).toBe(false); // already gone
  });
  it('ignores duplicate inserts (set semantics) and refuses a full table', () => {
    const t = new RobinHood(4);
    ['a', 'b', 'c', 'd'].forEach((k) => t.insert(k));
    expect(t.insert('a')).toBe(true);  // dup → no-op, still ok
    expect(t.insert('e')).toBe(false); // full
    expect(t.size).toBe(4);
  });
});

describe('the Robin Hood guarantee: flatter probe distances than plain linear probing', () => {
  it('lower variance and smaller max probe distance at high load', () => {
    const cap = 64;
    const keys = Array.from({ length: 48 }, (_, i) => 'key-' + i);
    const rh = new RobinHood(cap); keys.forEach((k) => rh.insert(k));
    const rhs = rh.probeStats();
    const plain = plainLinearProbe(keys, cap);
    expect(rhs.variance).toBeLessThanOrEqual(plain.variance);
    expect(rhs.max).toBeLessThanOrEqual(plain.max);
    expect(rhs.distances).toHaveLength(48); // every key accounted for
  });
});

describe('agrees with a reference set under random inserts and deletes (fuzz)', () => {
  it('3000 runs: lookup returns exactly the present keys', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let run = 0; run < 3000; run++) {
      const c = 8 + rnd(56);
      const t = new RobinHood(c); const ref = new Set<string>();
      for (let op = 0; op < c - 1; op++) {
        if (rnd(4) === 0 && ref.size) { const arr = [...ref]; const del = arr[rnd(arr.length)]; t.delete(del); ref.delete(del); }
        else if (t.size < c) { const key = 'k' + rnd(c * 2); t.insert(key); ref.add(key); }
      }
      for (const k of ref) expect(t.lookup(k)).toBeGreaterThanOrEqual(0);
      for (let x = 0; x < c * 2; x++) { const k = 'k' + x; if (!ref.has(k)) expect(t.lookup(k)).toBe(-1); }
    }
  });
});
