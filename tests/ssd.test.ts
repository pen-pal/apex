import { describe, it, expect } from 'vitest';
import { Ssd } from '../src/web/ssd';

describe('the flash translation layer', () => {
  it('writes are out-of-place: overwriting a logical page uses a fresh physical page and stales the old', () => {
    const d = new Ssd(4, 4);
    d.write(0);
    const before = d.read(0);
    d.write(0);
    const after = d.read(0);
    expect(before).not.toBe(after);            // new physical page
    expect(d.counts().stale).toBe(1);          // the old page is now stale
  });

  it('keeps data integrity: every live logical page maps to a valid physical page that holds it', () => {
    const d = new Ssd(8, 8);
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const live = new Set<number>();
    for (let i = 0; i < 2000; i++) { const lpn = rnd(40); d.write(lpn); live.add(lpn); }
    for (const lpn of live) {
      const idx = d.read(lpn);
      expect(idx).not.toBeNull();
      const pg = d.blocks[Math.floor(idx! / 8)][idx! % 8];
      expect(pg.state).toBe('valid');
      expect(pg.lpn).toBe(lpn);
    }
    expect(d.counts().valid).toBe(live.size);  // exactly one valid page per live logical page
  });

  it('garbage collection keeps free space and causes write amplification (> 1)', () => {
    const d = new Ssd(8, 8);
    let s = 3; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let i = 0; i < 2000; i++) d.write(rnd(40));
    expect(d.counts().free).toBeGreaterThan(0);          // GC always reclaims room
    expect(d.writeAmplification()).toBeGreaterThan(1);   // GC relocations add physical writes
    expect(d.writeAmplification()).toBeLessThan(10);     // but bounded
  });

  it('wear-levels: erases are spread across blocks, not piled on one', () => {
    const d = new Ssd(8, 8);
    let s = 5; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let i = 0; i < 3000; i++) d.write(rnd(40));
    const used = d.erases.filter((e) => e > 0).length;
    expect(used).toBeGreaterThanOrEqual(d.numBlocks - 1); // nearly every block took erases
  });

  // Regression: GC must NEVER erase a block whose valid pages weren't relocated (data loss). Over-provisioning
  // reserves one block so GC always has room; a brand-new page is rejected once the drive is at capacity.
  const integrityOk = (d: Ssd): boolean => {
    let held = 0;
    for (let b = 0; b < d.numBlocks; b++) for (let p = 0; p < d.pagesPerBlock; p++) {
      const pg = d.blocks[b][p];
      if (pg.state === 'valid') { if (d.read(pg.lpn) !== b * d.pagesPerBlock + p) return false; held++; }
    }
    return held === d.counts().valid; // every valid page is mapped back; no duplicates/dangling
  };

  it('exposes an over-provisioned capacity and rejects new pages past it', () => {
    const d = new Ssd(8, 8);
    expect(d.capacity).toBe((8 - 1) * 8); // one block reserved
    for (let l = 0; l < 200; l++) d.write(l); // try to write far more distinct pages than capacity
    expect(d.counts().valid).toBeLessThanOrEqual(d.capacity);
    expect(integrityOk(d)).toBe(true);
  });

  it('never loses data even at/near capacity (the audit counterexample + a hard fuzz)', () => {
    // exact audit scenario: fill with distinct pages, then overwrite — must stay consistent
    const d = new Ssd(8, 8);
    for (let l = 0; l < 63; l++) d.write(l);
    d.write(0); d.write(1);
    expect(integrityOk(d)).toBe(true);

    // hard fuzz: working sets right at capacity across many geometries and seeds
    for (let seed = 1; seed <= 400; seed++) {
      let s = seed; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
      const dd = new Ssd(2 + rnd(6), 2 + rnd(6));
      const range = Math.max(1, dd.capacity - rnd(3));
      for (let i = 0; i < 400; i++) dd.write(rnd(range + 3));
      expect(integrityOk(dd)).toBe(true);
    }
  });
});
