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
});
