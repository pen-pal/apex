// Address decoding & the memory bus — how the CPU reaches out and touches the right chip. A CPU has three buses:
// the ADDRESS bus (one-way, CPU→everyone, carrying which location it wants), the DATA bus (two-way, carrying the
// byte itself), and the CONTROL bus (read vs write, timing). The problem: ROM, RAM, and every I/O device all sit
// on the same shared address and data buses in parallel. When the CPU puts an address out, they must agree on
// exactly ONE of them to respond — otherwise several chips drive the data bus at once and you get garbage (or a
// short). That job is ADDRESS DECODING: a small block of logic looks at the HIGH address bits and asserts exactly
// one chip-select line, enabling one device while the rest stay silent (their outputs tri-stated off the bus).
// Split a 16-bit space (64 KB) by its top two bits and a 2-to-4 decoder gives four 16 KB pages, one per device;
// the low 14 bits are the offset the chosen chip decodes internally (down to its own rows/columns, for DRAM). The
// elegant consequence is MEMORY-MAPPED I/O: because an I/O device is selected by an address range just like RAM,
// the CPU talks to a keyboard, screen, or disk controller with the same load/store instructions it uses for
// memory — no special I/O opcodes needed. This models the bus decode: address → chip-select → device + offset.
// Reference: any computer-architecture text; the classic 6502/Z80 memory map and 74x138 address decoders.

export interface Region { name: string; kind: 'ROM' | 'RAM' | 'I/O'; page: number }
// A 64 KB space split into four 16 KB pages by address bits A15..A14 (a 2-to-4 decoder).
export const MAP: Region[] = [
  { name: 'ROM (boot code)', kind: 'ROM', page: 0 },   // 0x0000–0x3FFF
  { name: 'RAM (work)', kind: 'RAM', page: 1 },         // 0x4000–0x7FFF
  { name: 'RAM (video)', kind: 'RAM', page: 2 },        // 0x8000–0xBFFF
  { name: 'I/O (devices)', kind: 'I/O', page: 3 },      // 0xC000–0xFFFF
];
export const PAGE_BITS = 14;                            // 16 KB pages
export const PAGE_SIZE = 1 << PAGE_BITS;

export interface Decode { page: number; region: Region; offset: number; selects: boolean[] }

/** Decode a 16-bit address: the top 2 bits pick a page (chip-select), the low 14 are the offset into that chip. */
export function decode(addr: number, map: Region[] = MAP): Decode {
  const a = addr & 0xffff;
  const page = (a >>> PAGE_BITS) & 0b11;               // A15,A14 → one of 4
  const region = map[page];
  const offset = a & (PAGE_SIZE - 1);
  const selects = map.map((_, i) => i === page);        // 2-to-4 decoder: exactly one line high
  return { page, region, offset, selects };
}

/** Start/end address of a page (inclusive), for display. */
export const pageRange = (page: number): [number, number] => [page << PAGE_BITS, ((page + 1) << PAGE_BITS) - 1];
