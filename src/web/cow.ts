// Copy-on-write fork — why fork() is cheap even for a process using gigabytes of memory. Instead of
// duplicating every page up front, fork makes the child's page tables point at the SAME physical frames
// as the parent, marked read-only, and just bumps each frame's reference count. Both processes read the
// shared pages happily. Only when one of them WRITES does the kernel trap, allocate a fresh frame, copy
// that single page, and repoint the writer's entry — so you pay for exactly the pages that actually get
// modified, lazily. If the child immediately exec()s (replacing its whole address space), almost nothing
// was ever copied. This is what makes fork+exec, forking web servers, and snapshotting fast. Reference:
// the Unix fork/COW mechanism; OSTEP ch.5 / the VM chapters.

export type Proc = 'parent' | 'child';
export interface PageView { index: number; frame: number; shared: boolean; refcount: number }
export interface CowState { copies: number; parent: number[]; child: number[] | null; refcount: Record<number, number> }

export class CowMemory {
  private nextFrame: number;
  private refcount: Record<number, number> = {};
  private parent: number[];          // parent's page table: page index → frame id
  private child: number[] | null = null;
  copies = 0;                        // physical frames allocated due to a COW fault

  constructor(pages: number) {
    this.parent = Array.from({ length: pages }, (_, i) => i);
    for (let i = 0; i < pages; i++) this.refcount[i] = 1;
    this.nextFrame = pages;
  }

  /** fork(): the child shares every parent frame read-only; no data is copied (just refcount bumps). */
  fork() {
    this.child = [...this.parent];
    for (const f of this.parent) this.refcount[f]++;
  }

  private table(p: Proc) { return p === 'parent' ? this.parent : this.child!; }

  /** A write by `p` to page `i`: if the frame is shared, fault → allocate + copy + repoint; else write in place. */
  write(p: Proc, i: number) {
    const tbl = this.table(p);
    const frame = tbl[i];
    if (this.refcount[frame] > 1) {           // shared → copy-on-write fault
      const fresh = this.nextFrame++;
      this.refcount[frame]--;
      this.refcount[fresh] = 1;
      tbl[i] = fresh;
      this.copies++;
    }
    // else: already private (refcount 1) → write in place, no copy
  }

  /** exec(): the child replaces its whole address space — its shared frames are dropped, nothing copied. */
  execChild() {
    if (!this.child) return;
    for (const f of this.child) this.refcount[f]--;
    this.child = Array.from({ length: this.parent.length }, () => -1); // brand-new (unmapped here) space
  }

  view(p: Proc): PageView[] {
    const tbl = this.table(p);
    return tbl.map((frame, index) => ({ index, frame, shared: frame >= 0 && this.refcount[frame] > 1, refcount: frame >= 0 ? this.refcount[frame] : 0 }));
  }
  state(): CowState { return { copies: this.copies, parent: [...this.parent], child: this.child ? [...this.child] : null, refcount: { ...this.refcount } }; }
}
