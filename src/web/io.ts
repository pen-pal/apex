// How the CPU moves data to and from a device — and the three answers, each trading CPU time for complexity.
// Say a disk or network card has N bytes for main memory. (1) PROGRAMMED I/O (polling): the CPU spins reading a
// status register until the device says "ready," then copies the byte itself, and repeats. Dead simple, but the
// CPU is 100% consumed for the whole transfer — every cycle spent waiting or copying is a cycle stolen from real
// work. (2) INTERRUPT-DRIVEN: the CPU tells the device "interrupt me when ready" and goes off to do other work;
// each time a byte arrives the device raises an IRQ, the CPU stops, saves its state, runs a short handler to copy
// the byte, and resumes. Now the CPU is free between bytes — but it pays a fixed interrupt overhead (context
// save/restore + dispatch, tens to hundreds of cycles) for EVERY byte, so a fast device drowns it in interrupts.
// (3) DMA (Direct Memory Access): the CPU programs a separate DMA controller once with a source, a destination,
// and a count, then forgets about it; the controller streams all N bytes straight into memory over the bus and
// raises just ONE interrupt at the very end. The CPU cost is now CONSTANT — a setup plus one interrupt — no matter
// how big the transfer, which is why every disk, NIC, GPU, and sound card uses DMA for bulk data (the controller
// only "steals" occasional bus cycles from the CPU). This models the CPU cycles each strategy costs to move N
// bytes. Reference: any OS/architecture text (Patterson & Hennessy; Tanenbaum).

export type Strategy = 'polling' | 'interrupt' | 'dma';
export interface Costs { pollCycles: number; copyCycles: number; isrCycles: number; dmaSetup: number }
export const DEFAULTS: Costs = { pollCycles: 2, copyCycles: 1, isrCycles: 60, dmaSetup: 80 };

export interface IoResult { strategy: Strategy; cpuCycles: number; interrupts: number; scalesWithN: boolean }

/** CPU cycles STOLEN from useful work to move `bytes` bytes under a strategy. */
export function ioCost(strategy: Strategy, bytes: number, c: Costs = DEFAULTS): IoResult {
  switch (strategy) {
    case 'polling':   // CPU spins on status + copies every byte itself — busy the whole time
      return { strategy, cpuCycles: bytes * (c.pollCycles + c.copyCycles), interrupts: 0, scalesWithN: true };
    case 'interrupt': // one IRQ per byte: fixed handler overhead + copy, but CPU free between
      return { strategy, cpuCycles: bytes * (c.isrCycles + c.copyCycles), interrupts: bytes, scalesWithN: true };
    case 'dma':       // program the controller once, one completion IRQ — constant in N
      return { strategy, cpuCycles: c.dmaSetup + c.isrCycles, interrupts: 1, scalesWithN: false };
  }
}

/** The smallest transfer size at which DMA costs the CPU less than interrupt-driven I/O. */
export function dmaCrossover(c: Costs = DEFAULTS): number {
  // dmaSetup + isr < bytes*(isr+copy)  →  bytes > (dmaSetup+isr)/(isr+copy)
  return Math.floor((c.dmaSetup + c.isrCycles) / (c.isrCycles + c.copyCycles)) + 1;
}
