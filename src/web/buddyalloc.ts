// Buddy memory allocator — the classic scheme the Linux kernel uses for its page allocator, and a lovely
// answer to "how does malloc hand out and reclaim memory without the free space rotting into confetti?" All
// blocks are powers of two. To satisfy a request you round it UP to the next power of two and hand out a block
// of that size; if you only have a bigger free block, you split it in half — repeatedly — until you reach the
// right size, and the two halves you create are "buddies." The magic is in freeing: when a block is released,
// you check whether its buddy (the other half it was split from) is also free; if so, you instantly coalesce
// the pair back into the parent block, and keep coalescing up the tree. Because a block of size S at offset A
// always has its buddy at exactly A XOR S, that check is one bit-flip and a lookup — no scanning. The payoff is
// fast (O(log n)) allocation and, crucially, aggressive de-fragmentation on free, so large contiguous blocks
// keep reappearing. The cost is INTERNAL fragmentation: ask for 33 units and you're given 64, wasting 31.
// Reference: Knuth, TAOCP vol. 1 (buddy system); the Linux page allocator.

export interface Block { offset: number; size: number; order: number; state: 'free' | 'used' }

export class Buddy {
  readonly total: number;      // total pool size (a power of two)
  readonly min: number;        // smallest allocatable block (a power of two)
  readonly maxOrder: number;   // order of the whole pool
  private freeLists: Set<number>[] = []; // freeLists[order] = set of free block offsets
  private used = new Map<number, number>(); // offset -> order of allocated blocks

  constructor(total = 1024, min = 32) {
    this.total = total; this.min = min;
    this.maxOrder = Math.log2(total / min);
    for (let o = 0; o <= this.maxOrder; o++) this.freeLists[o] = new Set();
    this.freeLists[this.maxOrder].add(0); // one big free block covering the pool
  }

  size(order: number): number { return this.min << order; }
  private orderFor(bytes: number): number { let o = 0; while (this.size(o) < bytes) o++; return o; }
  private take(order: number): number { const off = this.freeLists[order].values().next().value as number; this.freeLists[order].delete(off); return off; }

  /** Allocate at least `bytes`; returns the block offset, or null if it can't be satisfied. */
  alloc(bytes: number): number | null {
    if (bytes <= 0 || bytes > this.total) return null;
    const need = this.orderFor(bytes);
    let o = need;
    while (o <= this.maxOrder && this.freeLists[o].size === 0) o++; // find the smallest available block that fits
    if (o > this.maxOrder) return null;                              // no block large enough
    while (o > need) {                                               // split down to the needed order
      const off = this.take(o);
      const half = this.size(o - 1);
      this.freeLists[o - 1].add(off);
      this.freeLists[o - 1].add(off + half);                        // the two buddies
      o--;
    }
    const off = this.take(need);
    this.used.set(off, need);
    return off;
  }

  /** Free a previously allocated block; coalesces with its buddy up the tree. Returns false if not allocated. */
  release(offset: number): boolean {
    if (!this.used.has(offset)) return false;
    let o = this.used.get(offset)!;
    this.used.delete(offset);
    let off = offset;
    while (o < this.maxOrder) {
      const buddy = off ^ this.size(o);        // the buddy is one bit-flip away
      if (this.freeLists[o].has(buddy)) { this.freeLists[o].delete(buddy); off = Math.min(off, buddy); o++; } // merge
      else break;
    }
    this.freeLists[o].add(off);
    return true;
  }

  /** A left-to-right layout of the current blocks (used and free), for rendering. */
  layout(): Block[] {
    const blocks: Block[] = [];
    for (const [offset, order] of this.used) blocks.push({ offset, size: this.size(order), order, state: 'used' });
    for (let o = 0; o <= this.maxOrder; o++) for (const offset of this.freeLists[o]) blocks.push({ offset, size: this.size(o), order: o, state: 'free' });
    return blocks.sort((a, b) => a.offset - b.offset);
  }

  stats(): { used: number; free: number; largestFree: number; freeBlocks: number } {
    let used = 0; for (const order of this.used.values()) used += this.size(order);
    let largestFree = 0, freeBlocks = 0;
    for (let o = this.maxOrder; o >= 0; o--) { if (this.freeLists[o].size) { if (!largestFree) largestFree = this.size(o); freeBlocks += this.freeLists[o].size; } }
    return { used, free: this.total - used, largestFree, freeBlocks };
  }
}
