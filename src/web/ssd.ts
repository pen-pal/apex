// How an SSD works — and why it's so different from a disk. Flash stores a bit as trapped charge on a
// floating-gate transistor; no moving parts, so reads are fast and uniform. The twist is a hard physical
// asymmetry in what you can do to it. The unit you READ and WRITE (program) is a PAGE (a few KB). But the unit
// you ERASE is a whole BLOCK (hundreds of pages). And a page can't be overwritten in place — flash programming
// only flips bits one way, so to change a page you must first erase its entire block back to blank. Erasing is
// slow and, worse, each cell physically wears out after a limited number of program/erase cycles. Overwriting
// data in place would erase-and-rewrite a huge block for every small write and burn out hot cells fast. So every
// SSD hides a FLASH TRANSLATION LAYER (FTL): the drive lies about where data is. A logical block address maps to
// some physical page, and a "write" never overwrites — it programs a FRESH page, repoints the map, and marks the
// old page STALE. When free pages run low, GARBAGE COLLECTION picks a block, copies its few still-valid pages
// elsewhere, and erases the block to reclaim the stale space. That copying means one logical write can cause
// several physical writes — WRITE AMPLIFICATION — and the FTL spreads erases across all blocks (WEAR LEVELING) so
// no cell dies early. This models the FTL: out-of-place writes, page states, garbage collection, write
// amplification, and erase wear. Reference: flash datasheets; Agrawal et al., "Design Tradeoffs for SSD
// Performance" (2008).

export type PageState = 'free' | 'valid' | 'stale';
export interface Page { state: PageState; lpn: number } // lpn = which logical block lives here (-1 if none)

export class Ssd {
  blocks: Page[][];
  erases: number[];
  readonly capacity: number;                 // logical pages the drive exposes (< physical: over-provisioning)
  private map = new Map<number, number>(); // logical page number → physical page index
  logicalWrites = 0;
  physicalWrites = 0;

  constructor(public numBlocks = 8, public pagesPerBlock = 8) {
    this.blocks = Array.from({ length: numBlocks }, () => Array.from({ length: pagesPerBlock }, () => ({ state: 'free' as PageState, lpn: -1 })));
    this.erases = new Array(numBlocks).fill(0);
    this.capacity = (numBlocks - 1) * pagesPerBlock; // reserve one block of spare space so GC can always relocate
  }

  private pageAt(idx: number): Page { return this.blocks[Math.floor(idx / this.pagesPerBlock)][idx % this.pagesPerBlock]; }
  private freePages(): number { let n = 0; for (const b of this.blocks) for (const p of b) if (p.state === 'free') n++; return n; }
  private findFree(): number { for (let i = 0; i < this.numBlocks * this.pagesPerBlock; i++) if (this.pageAt(i).state === 'free') return i; return -1; }
  private stateCount(block: number, state: PageState): number { let n = 0; for (const p of this.blocks[block]) if (p.state === state) n++; return n; }

  /** Write a logical page: program a fresh physical page out-of-place, stale the old, GC when space runs low.
   *  A brand-new logical page is rejected once the drive is at its (over-provisioned) capacity. */
  write(lpn: number): void {
    this.logicalWrites++;
    if (!this.map.has(lpn) && this.map.size >= this.capacity) return; // drive full — spare capacity is reserved for GC
    let guard = 0;
    while (this.freePages() <= this.pagesPerBlock && guard++ <= this.numBlocks) if (!this.gc()) break; // reclaim while GC can progress
    const idx = this.findFree();
    if (idx < 0) return;                       // no free page (spare guarantees this shouldn't happen) — drop, never lose data
    const old = this.map.get(lpn);
    if (old !== undefined) this.pageAt(old).state = 'stale';
    const pg = this.pageAt(idx); pg.state = 'valid'; pg.lpn = lpn;
    this.map.set(lpn, idx); this.physicalWrites++;
  }

  read(lpn: number): number | null { const idx = this.map.get(lpn); return idx === undefined ? null : idx; }

  /** Garbage-collect: erase the most-stale block whose valid pages FIT in the free space elsewhere (so nothing is
   *  ever lost). Relocate its valid pages first, then erase. Returns true if it reclaimed a block. */
  gc(): boolean {
    const totalFree = this.freePages();
    let best = -1, bestStale = 0;
    for (let b = 0; b < this.numBlocks; b++) {
      const stale = this.stateCount(b, 'stale');
      if (stale === 0) continue;                                   // nothing to reclaim here
      const valid = this.stateCount(b, 'valid');
      if (totalFree - this.stateCount(b, 'free') < valid) continue; // can't relocate all valid pages safely → skip
      if (stale > bestStale || (stale === bestStale && best >= 0 && this.erases[b] < this.erases[best])) { best = b; bestStale = stale; }
    }
    if (best < 0) return false;                                    // no block is safe to reclaim right now
    for (let p = 0; p < this.pagesPerBlock; p++) {
      const pg = this.blocks[best][p];
      if (pg.state === 'valid') { const dst = this.findFreeExcluding(best); const d = this.pageAt(dst); d.state = 'valid'; d.lpn = pg.lpn; this.map.set(pg.lpn, dst); this.physicalWrites++; }
    }
    for (const pg of this.blocks[best]) { pg.state = 'free'; pg.lpn = -1; } // erase (all valid pages are safely relocated)
    this.erases[best]++;
    return true;
  }
  private findFreeExcluding(block: number): number {
    for (let i = 0; i < this.numBlocks * this.pagesPerBlock; i++) if (Math.floor(i / this.pagesPerBlock) !== block && this.pageAt(i).state === 'free') return i;
    return -1;
  }

  writeAmplification(): number { return this.logicalWrites === 0 ? 1 : this.physicalWrites / this.logicalWrites; }
  counts(): { free: number; valid: number; stale: number } {
    let free = 0, valid = 0, stale = 0;
    for (const b of this.blocks) for (const p of b) p.state === 'free' ? free++ : p.state === 'valid' ? valid++ : stale++;
    return { free, valid, stale };
  }
}
