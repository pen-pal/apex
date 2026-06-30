// Virtual-to-physical address translation — the x86-64 4-level page-table walk. A 48-bit virtual
// address splits into four 9-bit table indices plus a 12-bit page offset; the MMU chases pointers
// CR3 → PML4 → PDPT → PD → PT to a physical frame, then tacks the offset back on. If any level's
// entry is "not present", the walk stops with a PAGE FAULT, which the OS handles (demand paging) by
// allocating a frame and restarting the instruction. The bit split is exact per the Intel SDM Vol.3
// §4.5 (4-level paging) / AMD64 APM Vol.2 §5.3 — 9/9/9/9/12. Anchored to that split in tests.
//
// NOTE: a 48-bit VA exceeds JS's 32-bit bitwise range, so we decompose with integer division/modulo
// (2^48 < 2^53, so it stays exact in a double) rather than >> / &.

export const LEVELS = ['PML4', 'PDPT', 'PD', 'PT'] as const;
export type Level = typeof LEVELS[number];
export const PAGE_BITS = 12;
export const INDEX_BITS = 9;            // each level indexes 512 entries
export const VA_BITS = 48;

export interface VaFields { pml4: number; pdpt: number; pd: number; pt: number; offset: number }

/** Split a 48-bit virtual address into its four table indices + page offset (Intel SDM §4.5). */
export function decompose(va: number): VaFields {
  return {
    pml4: Math.floor(va / 2 ** 39) % 512,
    pdpt: Math.floor(va / 2 ** 30) % 512,
    pd: Math.floor(va / 2 ** 21) % 512,
    pt: Math.floor(va / 2 ** 12) % 512,
    offset: va % 4096,
  };
}

/** The va as a fixed-width binary string, MSB first, grouped as [pml4|pdpt|pd|pt|offset]. */
export function vaBinary(va: number): string[] {
  const fields = decompose(va);
  return [
    fields.pml4.toString(2).padStart(9, '0'),
    fields.pdpt.toString(2).padStart(9, '0'),
    fields.pd.toString(2).padStart(9, '0'),
    fields.pt.toString(2).padStart(9, '0'),
    fields.offset.toString(2).padStart(12, '0'),
  ];
}

// A page table is a sparse nested map; a leaf (PT entry) holds a physical frame number. We build the
// nested structure from a flat list of mapped pages so the walk has real entries to chase or miss.
export interface Mapping { va: number; frame: number }      // va is page-aligned; frame is the PFN
type Node = Map<number, Node | number>;

export interface WalkStep { level: Level; index: number; present: boolean }
export interface WalkResult { steps: WalkStep[]; hit: boolean; frame: number | null; phys: number | null; faultLevel: Level | null }

export class PageTable {
  private root: Node = new Map();
  constructor(mappings: Mapping[] = []) { for (const m of mappings) this.map(m.va, m.frame); }

  /** Install a mapping for the page containing `va`, creating intermediate tables as needed. */
  map(va: number, frame: number): void {
    const f = decompose(va);
    const path = [f.pml4, f.pdpt, f.pd];
    let node = this.root;
    for (const idx of path) {
      let next = node.get(idx);
      if (!(next instanceof Map)) { next = new Map(); node.set(idx, next); }
      node = next;
    }
    node.set(f.pt, frame >>> 0);
  }

  /** Walk CR3 → … → PT for `va`, recording each level and stopping at the first not-present entry. */
  translate(va: number): WalkResult {
    const f = decompose(va);
    const idx = [f.pml4, f.pdpt, f.pd, f.pt];
    const steps: WalkStep[] = [];
    let node: Node | number | undefined = this.root;
    for (let i = 0; i < 4; i++) {
      const present = node instanceof Map && node.has(idx[i]);
      steps.push({ level: LEVELS[i], index: idx[i], present });
      if (!present) return { steps, hit: false, frame: null, phys: null, faultLevel: LEVELS[i] };
      node = (node as Node).get(idx[i]);
    }
    const frame = node as number;
    return { steps, hit: true, frame, phys: frame * 4096 + f.offset, faultLevel: null };
  }

  isMapped(va: number): boolean { return this.translate(va).hit; }
}

export const hex = (n: number, pad = 0) => '0x' + n.toString(16).toUpperCase().padStart(pad, '0');
