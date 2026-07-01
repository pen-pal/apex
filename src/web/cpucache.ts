// The CPU cache — the small, fast SRAM that hides main memory's ~100 ns latency behind ~1–4 ns hits. It exploits
// LOCALITY: programs reuse the same addresses (temporal) and nearby ones (spatial). Memory moves in fixed BLOCKS
// (a cache line, typically 64 bytes), so touching one byte pulls in its whole line. The cache is organized as a
// grid of SETS, each holding a few WAYS (lines). A physical address is split into three fields: the low bits are
// the OFFSET within the line, the next bits are the SET INDEX (which row of the grid to look in), and the top
// bits are the TAG (which block, to disambiguate the lines that share a set). On access, the hardware jumps to
// the set the index names and compares the tag against every way in parallel: a match is a HIT (fast); no match
// is a MISS that fetches the line from memory and installs it, evicting the least-recently-used way if the set is
// full. Associativity is the key knob: a DIRECT-MAPPED cache (1 way) is fast and simple but two hot blocks that
// map to the same set evict each other forever (conflict misses); a FULLY-ASSOCIATIVE cache (1 set) never has
// conflicts but comparing every line is expensive; real caches sit in between (4–16 ways). This is the same
// address, decoded a second time: the DRAM section split it into bank/row/column; the cache splits it into
// tag/index/offset first. This models the decode, set-associative lookup, LRU eviction, and hit rate. Reference:
// Hennessy & Patterson, Computer Architecture (memory hierarchy).

export interface Fields { tag: number; index: number; offset: number }
export interface AccessResult { hit: boolean; index: number; tag: number; offset: number; evictedTag: number | null }

export class Cache {
  private sets: { tag: number; used: number }[][];
  private clock = 0;
  hits = 0; misses = 0;
  readonly offsetBits: number; readonly indexBits: number;

  constructor(public blockBytes = 64, public numSets = 8, public ways = 2) {
    this.sets = Array.from({ length: numSets }, () => []);
    this.offsetBits = Math.log2(blockBytes);
    this.indexBits = Math.log2(numSets);
  }

  decode(addr: number): Fields {
    const offset = addr & (this.blockBytes - 1);
    const index = Math.floor(addr / this.blockBytes) % this.numSets;
    const tag = Math.floor(addr / (this.blockBytes * this.numSets));
    return { tag, index, offset };
  }

  access(addr: number): AccessResult {
    const { tag, index, offset } = this.decode(addr);
    const set = this.sets[index];
    const line = set.find((l) => l.tag === tag);
    if (line) { line.used = ++this.clock; this.hits++; return { hit: true, index, tag, offset, evictedTag: null }; }
    this.misses++;
    let evictedTag: number | null = null;
    if (set.length < this.ways) set.push({ tag, used: ++this.clock });
    else {
      const lru = set.reduce((a, b) => (a.used < b.used ? a : b)); // least-recently-used way
      evictedTag = lru.tag; lru.tag = tag; lru.used = ++this.clock;
    }
    return { hit: false, index, tag, offset, evictedTag };
  }

  /** Current tags resident in a set (for display). */
  setContents(index: number): number[] { return this.sets[index].map((l) => l.tag); }
  hitRate(): number { const t = this.hits + this.misses; return t === 0 ? 0 : this.hits / t; }
  reset(): void { this.sets = Array.from({ length: this.numSets }, () => []); this.clock = 0; this.hits = 0; this.misses = 0; }
}
