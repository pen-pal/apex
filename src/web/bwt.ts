// The Burrows-Wheeler Transform — a REVERSIBLE permutation of a string that clusters similar characters
// together, which is why it sits at the heart of bzip2. Append a unique sentinel ($, sorting before
// every real character), list all rotations of the string, sort them lexicographically, and read off
// the LAST column: that's the BWT. It looks like scrambling, but it's a bijection — the inverse rebuilds
// the original by repeatedly prepending the BWT column and re-sorting (equivalently, the LF-mapping).
// The transform itself compresses nothing; it just makes runs that a move-to-front + RLE + entropy
// coder can crush. Exactly testable: BWT("banana$") = "annb$aa", and inverse(forward(s)) == s.
// Reference: Burrows & Wheeler, "A Block-sorting Lossless Data Compression Algorithm" (1994).

export const SENTINEL = '$';

export interface BwtResult { bwt: string; rotations: string[]; sorted: string[]; originalRow: number }

/** Forward BWT of `text` (a '$' sentinel is appended; `text` must not already contain it). */
export function forward(text: string): BwtResult {
  const s = text + SENTINEL;
  const n = s.length;
  const rotations = Array.from({ length: n }, (_, i) => s.slice(i) + s.slice(0, i));
  const sorted = [...rotations].sort();
  const bwt = sorted.map((r) => r[n - 1]).join('');
  const originalRow = sorted.indexOf(s);
  return { bwt, rotations, sorted, originalRow };
}

/** Inverse BWT: rebuild the sorted-rotation table column by column, then return the row ending in '$'. */
export function inverse(bwt: string): string {
  const n = bwt.length;
  let table = Array.from({ length: n }, () => '');
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) table[i] = bwt[i] + table[i]; // prepend the BWT column
    table.sort();
  }
  const row = table.find((r) => r.endsWith(SENTINEL))!;
  return row.slice(0, -1); // strip the sentinel
}

/** The last column (the BWT) and the first column (the sorted characters), for visual side-by-side. */
export function columns(sorted: string[]): { first: string; last: string } {
  const n = sorted.length;
  return { first: sorted.map((r) => r[0]).join(''), last: sorted.map((r) => r[n - 1]).join('') };
}

/** A crude "clustering" score: count adjacent equal characters (higher = more run-friendly for RLE). */
export function adjacency(s: string): number {
  let runs = 0;
  for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) runs++;
  return runs;
}
