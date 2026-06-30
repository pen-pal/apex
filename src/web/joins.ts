// Join algorithms — the three ways a database matches rows of R against rows of S on a join key, and
// why the optimizer cares which it picks. All three produce the IDENTICAL result; what differs is the
// work. Nested-loop compares every pair (|R|·|S|). Hash join builds a hash table on one side, then
// probes it once per row of the other (≈|R|+|S|), but needs memory and an equi-join. Sort-merge sorts
// both sides once (O(n log n)) then sweeps them with two cursors in a single linear pass — and leaves
// the output sorted. Comparison counts here are exact and hand-verifiable (see tests).
// Reference: Ramakrishnan & Gehrke / Garcia-Molina, the join-algorithms & cost chapters.

export interface Row { row: string; key: number }
export type Pair = [string, string]; // [R.row, S.row]

const pairKey = (p: Pair) => `${p[0]}|${p[1]}`;
/** Order-independent equality of two join results (all algorithms must agree). */
export const sameResult = (a: Pair[], b: Pair[]): boolean => {
  const sa = a.map(pairKey).sort(), sb = b.map(pairKey).sort();
  return sa.length === sb.length && sa.every((x, i) => x === sb[i]);
};

// ── nested-loop join: compare every (r, s) pair ───────────────────────────────
export interface NljResult { pairs: Pair[]; comparisons: number }
export function nestedLoop(R: Row[], S: Row[]): NljResult {
  const pairs: Pair[] = [];
  let comparisons = 0;
  for (const r of R) for (const s of S) { comparisons++; if (r.key === s.key) pairs.push([r.row, s.row]); }
  return { pairs, comparisons };
}

// ── hash join: build a hash table on S, then probe once per row of R ───────────
export interface HashResult { pairs: Pair[]; buildOps: number; probeLookups: number; probeComparisons: number; buckets: { key: number; rows: string[] }[] }
export function hashJoin(R: Row[], S: Row[]): HashResult {
  const table = new Map<number, string[]>();
  for (const s of S) { const b = table.get(s.key) ?? []; b.push(s.row); table.set(s.key, b); } // build
  const pairs: Pair[] = [];
  let probeComparisons = 0;
  for (const r of R) {
    const bucket = table.get(r.key);
    if (bucket) for (const s of bucket) { probeComparisons++; pairs.push([r.row, s]); } // exact-key bucket → every entry matches
  }
  const buckets = [...table.entries()].map(([key, rows]) => ({ key, rows })).sort((a, b) => a.key - b.key);
  return { pairs, buildOps: S.length, probeLookups: R.length, probeComparisons, buckets };
}

// ── sort-merge join: sort both, then sweep with two cursors ────────────────────
export interface MergeResult { pairs: Pair[]; mergeComparisons: number; sortedR: Row[]; sortedS: Row[] }
export function sortMerge(R: Row[], S: Row[]): MergeResult {
  const sortedR = [...R].sort((a, b) => a.key - b.key);
  const sortedS = [...S].sort((a, b) => a.key - b.key);
  const pairs: Pair[] = [];
  let i = 0, j = 0, mergeComparisons = 0;
  while (i < sortedR.length && j < sortedS.length) {
    mergeComparisons++;
    const k = sortedR[i].key, l = sortedS[j].key;
    if (k < l) i++;
    else if (k > l) j++;
    else {
      // equal key: emit the cross-product of the equal runs on both sides
      let iEnd = i; while (iEnd < sortedR.length && sortedR[iEnd].key === k) iEnd++;
      let jEnd = j; while (jEnd < sortedS.length && sortedS[jEnd].key === k) jEnd++;
      for (let a = i; a < iEnd; a++) for (let b = j; b < jEnd; b++) pairs.push([sortedR[a].row, sortedS[b].row]);
      i = iEnd; j = jEnd;
    }
  }
  return { pairs, mergeComparisons, sortedR, sortedS };
}
