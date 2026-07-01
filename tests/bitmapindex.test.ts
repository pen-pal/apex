import { describe, it, expect } from 'vitest';
import { buildIndex, evalQuery, bruteForce, predicateMask, popcount, bitsToRows, type Row } from '../src/web/bitmapindex';

const COLS = ['color', 'size', 'region'];
const rows: Row[] = [
  { color: 'red', size: 'L', region: 'US' },   // 0
  { color: 'blue', size: 'M', region: 'EU' },  // 1
  { color: 'red', size: 'S', region: 'EU' },   // 2
  { color: 'green', size: 'L', region: 'US' }, // 3
  { color: 'red', size: 'L', region: 'APAC' }, // 4
];
const idx = buildIndex(rows, COLS);

describe('the index is a bitmap per (column, value)', () => {
  it('sets bit i where row i has that value', () => {
    expect(bitsToRows(idx.color.red, rows.length)).toEqual([0, 2, 4]);
    expect(bitsToRows(idx.size.L, rows.length)).toEqual([0, 3, 4]);
    expect(bitsToRows(idx.region.EU, rows.length)).toEqual([1, 2]);
  });
});

describe('queries are bitwise operations', () => {
  it('AND = intersection of bitmaps', () => {
    const m = evalQuery(idx, [{ col: 'color', value: 'red' }, { col: 'size', value: 'L' }], 'AND', rows.length);
    expect(bitsToRows(m, rows.length)).toEqual([0, 4]); // red AND L
    expect(popcount(m)).toBe(2);
  });
  it('OR = union of bitmaps', () => {
    const m = evalQuery(idx, [{ col: 'color', value: 'green' }, { col: 'region', value: 'EU' }], 'OR', rows.length);
    expect(bitsToRows(m, rows.length)).toEqual([1, 2, 3]); // green OR in-EU
  });
  it('NOT = complement within the row count', () => {
    const m = predicateMask(idx, { col: 'region', value: 'EU', negate: true }, rows.length);
    expect(bitsToRows(m, rows.length)).toEqual([0, 3, 4]); // NOT EU
  });
  it('an empty query is all rows (AND) or none (OR)', () => {
    expect(popcount(evalQuery(idx, [], 'AND', rows.length))).toBe(5);
    expect(evalQuery(idx, [], 'OR', rows.length)).toBe(0);
  });
});

describe('agrees with a direct row scan (fuzz)', () => {
  it('20k random AND/OR/NOT queries match brute force', () => {
    const colors = ['red', 'green', 'blue'], sizes = ['S', 'M', 'L'], regions = ['US', 'EU', 'APAC'];
    const vals: Record<string, string[]> = { color: colors, size: sizes, region: regions };
    let s = 42; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 20000; t++) {
      const rs: Row[] = Array.from({ length: 1 + rnd(20) }, () => ({ color: colors[rnd(3)], size: sizes[rnd(3)], region: regions[rnd(3)] }));
      const ix = buildIndex(rs, COLS);
      const preds = Array.from({ length: 1 + rnd(4) }, () => { const c = COLS[rnd(3)]; return { col: c, value: vals[c][rnd(3)], negate: rnd(2) === 0 }; });
      const op = rnd(2) === 0 ? 'AND' : 'OR' as const;
      expect(evalQuery(ix, preds, op, rs.length) >>> 0).toBe(bruteForce(rs, preds, op) >>> 0);
    }
  });
});
