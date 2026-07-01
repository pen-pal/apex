import { describe, it, expect } from 'vitest';
import { Cache } from '../src/web/cpucache';

describe('address decode (tag / index / offset)', () => {
  it('splits by block size and set count', () => {
    const c = new Cache(64, 8, 2); // 6 offset bits, 3 index bits
    expect(c.offsetBits).toBe(6);
    expect(c.indexBits).toBe(3);
    expect(c.decode(0)).toEqual({ tag: 0, index: 0, offset: 0 });
    expect(c.decode(64)).toEqual({ tag: 0, index: 1, offset: 0 }); // next block → next set
    expect(c.decode(64 * 8)).toEqual({ tag: 1, index: 0, offset: 0 }); // wraps: same set, next tag
    expect(c.decode(0x1234)).toEqual({ tag: 9, index: 0, offset: 52 });
  });
});

describe('hits, misses, and locality', () => {
  it('a cold block misses, then bytes in the same line hit (spatial locality)', () => {
    const c = new Cache(64, 8, 4);
    expect(c.access(0).hit).toBe(false); // cold miss brings in the line
    expect(c.access(4).hit).toBe(true);  // same 64B line
    expect(c.access(0).hit).toBe(true);  // temporal
    const c2 = new Cache(64, 8, 4);
    let miss = 0; for (let a = 0; a < 64; a += 4) if (!c2.access(a).hit) miss++;
    expect(miss).toBe(1); // one miss for the whole 64B block
  });
});

describe('associativity fixes conflict misses', () => {
  it('a direct-mapped cache thrashes on two blocks that share a set; a 2-way holds both', () => {
    const dm = new Cache(64, 8, 1);
    for (let i = 0; i < 10; i++) { dm.access(0); dm.access(64 * 8); } // same index, different tag
    expect(dm.hitRate()).toBe(0); // they evict each other every time

    const sa = new Cache(64, 8, 2);
    for (let i = 0; i < 10; i++) { sa.access(0); sa.access(64 * 8); }
    expect(sa.hitRate()).toBeGreaterThan(0.85); // both live in the 2-way set
  });
});

describe('LRU eviction and capacity', () => {
  it('evicts the least-recently-used way', () => {
    const c = new Cache(64, 8, 2);
    c.access(0); c.access(64 * 8); // set 0: tags 0, 1
    c.access(0);                    // touch tag 0 → tag 1 is now LRU
    expect(c.access(64 * 16).evictedTag).toBe(1);
  });
  it('a working set larger than the cache suffers capacity misses', () => {
    const c = new Cache(64, 8, 2); // 16 lines
    for (let r = 0; r < 5; r++) for (let b = 0; b < 40; b++) c.access(b * 64);
    expect(c.hitRate()).toBeLessThan(0.5); // can't hold 40 blocks in 16 lines
  });
});
