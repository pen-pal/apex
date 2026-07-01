// RCU — Read-Copy-Update, the Linux kernel's trick for near-zero-cost reads of shared data. Readers take NO
// lock and never block: they just grab the current version and use it. A writer never mutates in place —
// it makes a private COPY, modifies the copy, then atomically swaps the published pointer to it (one pointer
// store). Any reader that was already traversing the OLD version keeps using it safely; readers arriving
// after the swap see the new one. The hard part is knowing when it's safe to FREE the old version: not until
// every reader that could still hold a reference to it has finished. That wait is the GRACE PERIOD — the old
// copy is reclaimed only once all pre-existing readers have passed through a "quiescent" state (here: unpinned
// it). Readers pay almost nothing; the writer pays the copy plus the grace-period wait. It's why RCU shines
// for read-mostly data (routing tables, config, the dcache). Reference: McKenney, Linux RCU.

export interface Version { id: number; value: string; retired: boolean; reclaimed: boolean; refs: number }

export class RCU {
  private versions: Version[] = [];
  private publishedId = 0;
  private nextId = 0;
  private nextReader = 0;
  private pins = new Map<number, number>(); // readerId -> version id it pinned

  constructor(initial: string) {
    this.publishedId = this.mk(initial).id;
  }
  private mk(value: string): Version {
    const v: Version = { id: this.nextId++, value, retired: false, reclaimed: false, refs: 0 };
    this.versions.push(v);
    return v;
  }
  private ver(id: number): Version { return this.versions.find((v) => v.id === id)!; }

  /** The version a new reader would see right now. */
  published(): Version { return this.ver(this.publishedId); }

  /** A reader enters its read-side critical section: it pins whatever is published *now*. Never blocks. */
  readerPin(): number {
    const rid = this.nextReader++;
    const v = this.published();
    v.refs++;
    this.pins.set(rid, v.id);
    return rid;
  }
  /** What a pinned reader sees — always its own consistent snapshot (old or new, never torn or freed). */
  read(readerId: number): string {
    const vid = this.pins.get(readerId);
    if (vid === undefined) throw new Error('reader not pinned');
    const v = this.ver(vid);
    if (v.reclaimed) throw new Error('use-after-free: reader read a reclaimed version'); // must never happen
    return v.value;
  }
  /** Reader leaves its critical section (a quiescent state). May end a grace period → reclaim the old copy. */
  readerUnpin(readerId: number): void {
    const vid = this.pins.get(readerId);
    if (vid === undefined) return;
    const v = this.ver(vid);
    v.refs--;
    this.pins.delete(readerId);
    this.tryReclaim(v);
  }

  /** Writer: copy the current value, modify the copy, atomically publish it, retire the old one. */
  update(mutate: (old: string) => string): void {
    const old = this.published();
    const nv = this.mk(mutate(old.value));
    this.publishedId = nv.id; // the atomic pointer swap — the instant readers start seeing the new version
    old.retired = true;
    this.tryReclaim(old); // may already be free if nobody was reading it
  }

  /** Reclaim a retired version once no reader still references it (grace period complete). */
  private tryReclaim(v: Version): void {
    if (v.retired && v.refs === 0 && v.id !== this.publishedId) v.reclaimed = true;
  }

  /** Versions still occupying memory (published + retired-but-not-yet-reclaimed). */
  liveVersions(): Version[] { return this.versions.filter((v) => !v.reclaimed); }
  /** Every version ever created (incl. reclaimed) — for visualizing the lifecycle. */
  allVersions(): Version[] { return this.versions.map((v) => ({ ...v })); }
  publishedId_(): number { return this.publishedId; }
  activeReaders(): { readerId: number; versionId: number }[] {
    return [...this.pins.entries()].map(([readerId, versionId]) => ({ readerId, versionId }));
  }
}
