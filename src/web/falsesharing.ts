// False sharing — the performance bug where two CPU cores fight over a cache line even though they touch
// completely different variables. Caches move memory in 64-byte LINES, not individual bytes. If thread A's
// counter and thread B's counter happen to sit in the SAME 64-byte line, then every time A writes its counter,
// the coherence protocol (MESI) must invalidate B's copy of the line to keep things consistent — and vice
// versa. So the line ricochets between the two cores' caches on every write, each bounce a ~100-cycle coherence
// miss, even though the two threads never read or write the SAME variable. It's "false" sharing because there's
// no real data dependency — just an accident of memory layout. The fix is to PAD the variables apart so each
// lands on its own line (or align them to a cache line). This is one of the most common invisible scaling
// killers in multithreaded code: add a thread and it gets SLOWER. This models the coherence traffic with vs
// without padding. Reference: Intel/AMD cache-coherence docs; the classic "@Contended" / cacheline-padding fix.

export const LINE = 64; // cache line size in bytes

export interface Layout { offsetA: number; offsetB: number } // byte offsets of the two counters
export const sameLine = (l: Layout): boolean => Math.floor(l.offsetA / LINE) === Math.floor(l.offsetB / LINE);

export interface Result {
  sameLine: boolean;
  transfers: number;   // cache-line bounces between cores (coherence misses)
  writes: number;
  cycles: number;      // total cycles for the write stream on this layout
  idealCycles: number; // cycles if every write hit L1 (no contention)
  slowdown: number;    // cycles / idealCycles
}

/** Simulate a stream of writes by two threads over a memory layout, counting cache-line bounces. */
export function simulate(layout: Layout, sequence: ('A' | 'B')[], hit = 4, miss = 100): Result {
  const same = sameLine(layout);
  let transfers = 0;
  if (same) {
    // one shared line: it lives in whichever core wrote last; a different writer must pull it over (a bounce)
    let owner: string | null = null;
    for (const w of sequence) if (owner !== w) { transfers++; owner = w; }
  }
  // padded → each thread keeps its own line in Modified state, every write is an L1 hit
  const cycles = same ? transfers * miss + (sequence.length - transfers) * hit : sequence.length * hit;
  const idealCycles = sequence.length * hit;
  return { sameLine: same, transfers, writes: sequence.length, cycles, idealCycles, slowdown: cycles / idealCycles };
}

/** Perfectly interleaved writes (two threads hammering in lockstep) — the worst case. */
export const interleaved = (n: number): ('A' | 'B')[] => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'A' : 'B'));
/** Bursty writes (each thread does a run before yielding) — much less contention even when sharing a line. */
export const bursty = (n: number, run: number): ('A' | 'B')[] => Array.from({ length: n }, (_, i) => (Math.floor(i / run) % 2 === 0 ? 'A' : 'B'));
