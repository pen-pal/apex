// Bitmap index — the indexing trick that makes "SELECT ... WHERE" fly over columns with few distinct values
// (status, country, gender, category), the workhorse of data warehouses and columnar stores. A normal B-tree
// index maps one value to a list of row IDs; that's great for high-cardinality columns you look up one value at
// a time, but terrible for analytics that AND/OR several low-cardinality conditions. A bitmap index instead
// keeps, for each distinct value of a column, a BITMAP: a string of bits, one per row, with a 1 wherever that
// row has that value. So "colour = red" is one bitmap, "size = L" is another. The magic is that a WHERE clause
// combining conditions becomes raw BITWISE arithmetic on those bitmaps — AND for conjunction, OR for
// disjunction, NOT for negation — which a CPU does 64 rows at a time, with no row visited that doesn't match.
// A query like `WHERE colour = red AND size = L AND region != EU` is three bitmap lookups and two ANDs and a
// complement, producing the exact set of matching rows as a single bitmap you can then count (popcount) or
// iterate. Bitmaps also compress beautifully when sparse (run-length / Roaring), so a column with millions of
// rows but a handful of values costs very little. The classic caveat — updates are expensive because you touch
// every value's bitmap — is why they shine in read-mostly analytics, not OLTP. This models the index and
// bitwise query evaluation. Reference: O'Neil, "Model 204" bitmap indexes (1987); every columnar DB since.

export interface Predicate { col: string; value: string; negate?: boolean }
export type Row = Record<string, string>;
export type Index = Record<string, Record<string, number>>; // col -> value -> row bitmap (bit i = row i)

const allOnes = (n: number) => (n >= 31 ? 0x7fffffff : (1 << n) - 1);

/** Build a bitmap per (column, value): bit i is set when row i has that value. */
export function buildIndex(rows: Row[], cols: string[]): Index {
  const idx: Index = {};
  for (const col of cols) {
    idx[col] = {};
    rows.forEach((r, i) => { const v = r[col]; idx[col][v] = (idx[col][v] ?? 0) | (1 << i); });
  }
  return idx;
}

/** The bitmap for a single predicate (complemented within nRows if negated). */
export function predicateMask(idx: Index, p: Predicate, nRows: number): number {
  const base = (idx[p.col]?.[p.value] ?? 0) >>> 0;
  return (p.negate ? ~base & allOnes(nRows) : base) >>> 0;
}

/** Evaluate a query: combine predicate bitmaps with AND or OR. Returns the matching-rows bitmap. */
export function evalQuery(idx: Index, preds: Predicate[], op: 'AND' | 'OR', nRows: number): number {
  if (preds.length === 0) return op === 'AND' ? allOnes(nRows) : 0;
  let acc = op === 'AND' ? allOnes(nRows) : 0;
  for (const p of preds) { const m = predicateMask(idx, p, nRows); acc = op === 'AND' ? acc & m : acc | m; }
  return acc >>> 0;
}

/** Ground truth: filter the rows directly, without the index. */
export function bruteForce(rows: Row[], preds: Predicate[], op: 'AND' | 'OR'): number {
  let mask = 0;
  rows.forEach((r, i) => {
    const results = preds.map((p) => (p.negate ? r[p.col] !== p.value : r[p.col] === p.value));
    const match = preds.length === 0 ? true : op === 'AND' ? results.every(Boolean) : results.some(Boolean);
    if (match) mask |= (1 << i);
  });
  return mask >>> 0;
}

export const popcount = (mask: number): number => { let c = 0, m = mask >>> 0; while (m) { c += m & 1; m >>>= 1; } return c; };
export const bitsToRows = (mask: number, n: number): number[] => Array.from({ length: n }, (_, i) => i).filter((i) => (mask >>> i) & 1);
