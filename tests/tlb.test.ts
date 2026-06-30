import { describe, it, expect } from 'vitest';
import { simulate, cost, loopAccesses } from '../src/web/tlb';

describe('TLB hits when the working set fits', () => {
  it('a loop over 3 pages with a 4-entry TLB: cold misses once, then all hits', () => {
    const r = simulate(loopAccesses(3, 3), 4); // [0,1,2, 0,1,2, 0,1,2]
    expect(r.misses).toBe(3);     // the three compulsory (cold) misses
    expect(r.hits).toBe(6);       // every subsequent access hits
    expect(r.hitRate).toBeCloseTo(6 / 9, 6);
  });
  it('repeated access to one page is a single miss then all hits', () => {
    const r = simulate([5, 5, 5, 5], 4);
    expect(r.misses).toBe(1);
    expect(r.hits).toBe(3);
  });
});

describe('thrashing when the working set exceeds the TLB', () => {
  it('a 3-page loop on a 2-entry TLB misses every single access (LRU evicts what it needs next)', () => {
    const r = simulate(loopAccesses(3, 3), 2);
    expect(r.hits).toBe(0);
    expect(r.misses).toBe(9);
    expect(r.hitRate).toBe(0);
  });
  it('growing the TLB to fit the working set flips it to nearly all hits', () => {
    expect(simulate(loopAccesses(3, 3), 3).hits).toBe(6); // now 3 fits
  });
});

describe('LRU eviction order', () => {
  it('evicts the least-recently-used entry', () => {
    // size 2: access 1,2 (fill), 1 (touch 1 → MRU), 3 (miss → evict 2, the LRU)
    const r = simulate([1, 2, 1, 3], 2);
    expect(r.steps[3].evicted).toBe(2);
    expect(r.steps[3].tlbAfter).toEqual([3, 1]);
  });
});

describe('the speedup the TLB buys', () => {
  it('a high hit rate makes the average access cost approach a single cycle', () => {
    const r = simulate(loopAccesses(4, 50), 8); // 4 pages, fits → ~99% hits
    const c = cost(r, 200);
    expect(c.withTlb).toBeLessThan(5);          // vs 100 cycles for a walk
    expect(c.speedup).toBeGreaterThan(20);
  });
});
