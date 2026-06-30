// The TLB (Translation Lookaside Buffer) — the tiny cache that makes virtual memory fast. Every memory
// access needs the virtual page number translated to a physical frame, and doing the full multi-level
// page-table walk each time would be ruinous (several extra memory reads per access). So the CPU caches
// recent translations in the TLB: a HIT resolves in ~1 cycle, a MISS pays for the walk (~tens to a
// hundred cycles) and then fills the TLB. Because programs have locality — loops touch the same few
// pages over and over — the hit rate is normally well above 99%, so the slow walk almost never happens.
// The catch is the WORKING SET: if the pages a loop touches outnumber the TLB's entries, every access
// evicts one it's about to need again (thrashing) and the hit rate collapses. Reference: Hennessy &
// Patterson; OSTEP ch.19 (TLBs). We model a fully-associative, LRU TLB.

export interface TlbStep { vpn: number; hit: boolean; evicted: number | null; tlbAfter: number[] }
export interface TlbResult { steps: TlbStep[]; hits: number; misses: number; hitRate: number }

export const HIT_CYCLES = 1;
export const MISS_CYCLES = 100; // a page-table walk on a miss

/** Simulate a fully-associative, LRU TLB of `size` entries over a sequence of virtual-page accesses. */
export function simulate(accesses: number[], size: number): TlbResult {
  const tlb: number[] = []; // front = most-recently-used
  const steps: TlbStep[] = [];
  let hits = 0, misses = 0;
  for (const vpn of accesses) {
    const i = tlb.indexOf(vpn);
    let evicted: number | null = null;
    if (i >= 0) { hits++; tlb.splice(i, 1); tlb.unshift(vpn); steps.push({ vpn, hit: true, evicted, tlbAfter: [...tlb] }); }
    else {
      misses++;
      if (tlb.length >= size) evicted = tlb.pop()!; // evict the LRU entry
      tlb.unshift(vpn);
      steps.push({ vpn, hit: false, evicted, tlbAfter: [...tlb] });
    }
  }
  return { steps, hits, misses, hitRate: accesses.length ? hits / accesses.length : 0 };
}

/** Average cycles per access with the TLB, vs always walking the page table (no TLB). */
export function cost(r: TlbResult, n: number) {
  const withTlb = (r.hits * HIT_CYCLES + r.misses * MISS_CYCLES) / (n || 1);
  return { withTlb, withoutTlb: MISS_CYCLES, speedup: MISS_CYCLES / (withTlb || 1) };
}

/** A loop touching `workingSet` pages, repeated `iters` times — the classic locality vs thrash pattern. */
export const loopAccesses = (workingSet: number, iters: number): number[] =>
  Array.from({ length: iters }, () => Array.from({ length: workingSet }, (_, p) => p)).flat();
