// How RAM actually works — DRAM (Dynamic RAM). A single bit of your computer's main memory is one capacitor and
// one transistor: charge on the capacitor = 1, empty = 0. That's why it's "dynamic" — the capacitor LEAKS, so
// every cell must be read and rewritten (REFRESHED) every ~64 ms or it forgets, which is the background tax DRAM
// pays that SRAM (your CPU cache, made of latching transistors) doesn't. Billions of these cells are organized as
// a grid of ROWS and COLUMNS inside BANKS; a memory access is not "read address X" but a little protocol. The
// memory controller decodes the physical address into (bank, row, column), then: ACTIVATE the row — copy its
// entire contents into the bank's ROW BUFFER (a line of sense amplifiers), which takes tRCD; then READ/WRITE the
// specific column out of that buffer, taking tCL. The row buffer is a cache one row wide, and it creates three
// very different latencies. If the row you want is already open (a row-buffer HIT), you skip straight to the
// column read — fastest. If no row is open (a MISS/empty), you pay the activate first. Worst, if a DIFFERENT row
// in that bank is open (a row-buffer CONFLICT), you must first PRECHARGE it back (tRP) before activating yours —
// slowest. This is why sequential and locality-friendly access patterns fly (they keep hitting the open row)
// while random access crawls, and why having many independent banks lets the controller overlap these protocols.
// This models the address decode, the per-bank row buffer, and the hit/miss/conflict latencies with realistic
// DDR4 timings. Reference: JEDEC DDR4 (JESD79-4); Jacob, Ng & Wang, "Memory Systems" (2007).

export interface DramConfig { burstBits: number; colBits: number; bankBits: number } // row = the remaining high bits
export const DDR4: DramConfig = { burstBits: 3, colBits: 10, bankBits: 4 };            // 8-byte burst, 1024 cols, 16 banks

export interface Addr { burst: number; column: number; bank: number; row: number }

/** Decode a physical byte address into (row, bank, column, burst-offset). Row-contiguous layout. */
export function decode(addr: number, cfg: DramConfig = DDR4): Addr {
  const burst = addr & ((1 << cfg.burstBits) - 1);
  const column = (addr >>> cfg.burstBits) & ((1 << cfg.colBits) - 1);
  const bank = (addr >>> (cfg.burstBits + cfg.colBits)) & ((1 << cfg.bankBits) - 1);
  const row = addr >>> (cfg.burstBits + cfg.colBits + cfg.bankBits);
  return { burst, column, bank, row };
}

/** Reassemble a physical address from its fields (inverse of decode). */
export function encode(a: Addr, cfg: DramConfig = DDR4): number {
  return (((a.row << cfg.bankBits | a.bank) << cfg.colBits | a.column) << cfg.burstBits | a.burst) >>> 0;
}

// Realistic DDR4-3200 CL22 timings (nanoseconds)
export const T = { RCD: 13.75, CL: 13.75, RP: 13.75, REFI: 7800, retentionMs: 64 };

export type RowState = 'hit' | 'miss' | 'conflict';
export interface AccessResult { addr: Addr; state: RowState; latencyNs: number }

/** A memory controller front-end: one open-row register per bank. */
export class Dram {
  private open = new Map<number, number>(); // bank → open row (absent = precharged/closed)
  constructor(private cfg: DramConfig = DDR4) {}

  access(physAddr: number): AccessResult {
    const a = decode(physAddr, this.cfg);
    const cur = this.open.get(a.bank);
    let state: RowState, latencyNs: number;
    if (cur === a.row) { state = 'hit'; latencyNs = T.CL; }                       // row already open
    else if (cur === undefined) { state = 'miss'; latencyNs = T.RCD + T.CL; }     // bank idle → activate
    else { state = 'conflict'; latencyNs = T.RP + T.RCD + T.CL; }                 // wrong row open → precharge first
    this.open.set(a.bank, a.row);
    return { addr: a, state, latencyNs };
  }
  openRow(bank: number): number | undefined { return this.open.get(bank); }
}

/** Refresh commands per 64 ms retention window for a device with `rows` rows (one tREFI apart). */
export const refreshesPerWindow = (rows: number): number => rows;
