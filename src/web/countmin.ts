// Count-Min Sketch (Cormode & Muthukrishnan, 2005) — count how often each item appears
// in a huge stream using a tiny fixed amount of memory, by accepting a one-sided error.
// A d×w grid of counters; each item is hashed by d independent functions to one cell per
// row, and adding the item bumps those d cells. To estimate its count, take the MINIMUM
// of its d cells — collisions only ever ADD to a counter, so the minimum is the cell
// least polluted by other items. The estimate is therefore never an underestimate; it can
// overestimate, and more rows/columns shrink that error. Pure and tested.

export interface Sketch { d: number; w: number; table: number[][]; seeds: number[] }

const SEEDS = [0x9e3779b1, 0x85ebca77, 0xc2b2ae3d, 0x27d4eb2f, 0x165667b1, 0xd3a2646c];

/** A small deterministic string hash seeded per row. */
function hashWith(s: string, seed: number, w: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0; // FNV-style mix
  }
  return h % w;
}

export function create(d: number, w: number): Sketch {
  return { d, w, table: Array.from({ length: d }, () => new Array(w).fill(0)), seeds: SEEDS.slice(0, d) };
}

/** The d cell columns an item maps to (one per row). */
export const cells = (s: Sketch, item: string): number[] => s.seeds.map((seed) => hashWith(item, seed, s.w));

export function add(s: Sketch, item: string, count = 1): void {
  cells(s, item).forEach((col, row) => { s.table[row][col] += count; });
}

/** Estimated count = the minimum across the item's d cells (never an underestimate). */
export function estimate(s: Sketch, item: string): number {
  return Math.min(...cells(s, item).map((col, row) => s.table[row][col]));
}

/** Build a sketch from a stream and also return the exact counts, for comparison. */
export function fromStream(d: number, w: number, stream: string[]): { sketch: Sketch; truth: Map<string, number> } {
  const sketch = create(d, w);
  const truth = new Map<string, number>();
  for (const x of stream) { add(sketch, x); truth.set(x, (truth.get(x) ?? 0) + 1); }
  return { sketch, truth };
}
