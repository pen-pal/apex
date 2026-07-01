import { describe, it, expect } from 'vitest';
import { Buddy, type Block } from '../src/web/buddyalloc';

const used = (b: Buddy) => b.layout().filter((x) => x.state === 'used');
const noOverlap = (bl: Block[]) => {
  const u = bl.filter((x) => x.state === 'used').sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < u.length; i++) if (u[i].offset < u[i - 1].offset + u[i - 1].size) return false;
  return true;
};

describe('allocation rounds up and splits', () => {
  it('a 100-byte request gets a 128 block and splits the pool down to it', () => {
    const b = new Buddy(1024, 32);
    const off = b.alloc(100);
    expect(off).toBe(0);
    const u = used(b);
    expect(u).toEqual([{ offset: 0, size: 128, order: 2, state: 'used' }]); // rounded 100 → 128
    // the splits leave one free 128, one free 256, one free 512
    expect(b.layout().filter((x) => x.state === 'free').map((x) => x.size).sort((a, c) => a - c)).toEqual([128, 256, 512]);
    expect(b.stats()).toMatchObject({ used: 128, free: 896, largestFree: 512 });
  });
  it('fails when no block is large enough', () => {
    const b = new Buddy(128, 32);
    expect(b.alloc(200)).toBeNull();       // bigger than the pool
    b.alloc(64); b.alloc(64);              // fill the pool
    expect(b.alloc(32)).toBeNull();        // nothing left
  });
});

describe('freeing coalesces buddies', () => {
  it('freeing both halves merges all the way back to the whole pool', () => {
    const b = new Buddy(256, 32);
    const x = b.alloc(32)!, y = b.alloc(32)!;   // buddies at 0 and 32
    expect([x, y]).toEqual([0, 32]);
    b.release(x); b.release(y);
    expect(b.stats().largestFree).toBe(256);     // fully coalesced
    expect(b.layout()).toEqual([{ offset: 0, size: 256, order: 3, state: 'free' }]);
  });
  it('does NOT coalesce while the buddy is still in use', () => {
    const b = new Buddy(256, 32);
    const x = b.alloc(32)!; b.alloc(32);         // x and its buddy both allocated
    b.release(x);                                // buddy still used → no merge
    expect(b.stats().largestFree).toBeLessThan(256);
    expect(b.layout().some((bl) => bl.offset === 0 && bl.size === 32 && bl.state === 'free')).toBe(true);
  });
  it('release returns false for an offset that is not allocated', () => {
    expect(new Buddy(256, 32).release(64)).toBe(false);
  });
});

describe('invariants hold under random alloc/free (fuzz)', () => {
  it('3000 runs: blocks always tile the pool with no overlap, and free-all returns one block', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 3000; t++) {
      const b = new Buddy(1024, 32); const live: number[] = [];
      for (let op = 0; op < 40; op++) {
        if (rnd(2) === 0) { const off = b.alloc(1 + rnd(400)); if (off !== null) live.push(off); }
        else if (live.length) { b.release(live.splice(rnd(live.length), 1)[0]); }
        const lay = b.layout();
        expect(lay.reduce((a, x) => a + x.size, 0)).toBe(1024); // blocks exactly cover the pool
        expect(noOverlap(lay)).toBe(true);
      }
      for (const o of live) b.release(o);
      expect(b.layout()).toEqual([{ offset: 0, size: 1024, order: 5, state: 'free' }]); // fully reclaimed
    }
  });
});
