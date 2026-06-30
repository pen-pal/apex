// Suffix array — a sorted index of every suffix of a string, and the workhorse behind fast full-text
// search. List all n suffixes, sort them lexicographically, and store their starting positions: that's
// the suffix array. Because the suffixes are sorted, every occurrence of a pattern P is a CONTIGUOUS
// block of them (all the suffixes that start with P), so you find all matches with two binary searches —
// O(m log n) — after an O(n log n) build, using just an integer array instead of a bulky tree. It's the
// space-frugal cousin of the suffix tree and the backbone of full-text indexes, bioinformatics (genome
// search), and the BWT (the BWT is literally the character before each sorted suffix). Reference: Manber
// & Myers (1990); Gonnet's PAT arrays.

/** Build the suffix array: the starting indices of all suffixes, sorted by suffix. (O(n² log n) naive
 *  sort — clear and exact for the demo; production uses an O(n) / O(n log n) construction.) */
export function buildSuffixArray(s: string): number[] {
  return Array.from({ length: s.length }, (_, i) => i).sort((a, b) => (s.slice(a) < s.slice(b) ? -1 : 1));
}

/** The lexicographically-sorted suffixes (for display), aligned with the suffix array. */
export const sortedSuffixes = (s: string, sa: number[]) => sa.map((i) => s.slice(i));

/** Find every start position of `pattern` in `s`, via the contiguous range of suffixes that begin with
 *  it. Returns the SA index range [lo, hi) and the text positions. */
export function search(s: string, sa: number[], pattern: string): { lo: number; hi: number; positions: number[] } {
  const cmp = (i: number) => s.slice(i, i + pattern.length).localeCompare(pattern);
  // lower bound: first suffix >= pattern
  let lo = 0, hi = sa.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (s.slice(sa[mid], sa[mid] + pattern.length) < pattern) lo = mid + 1; else hi = mid; }
  // upper bound: first suffix whose prefix > pattern
  let lo2 = lo, hi2 = sa.length;
  while (lo2 < hi2) { const mid = (lo2 + hi2) >> 1; if (s.slice(sa[mid], sa[mid] + pattern.length) <= pattern) lo2 = mid + 1; else hi2 = mid; }
  const range = sa.slice(lo, lo2).filter((i) => cmp(i) === 0);
  return { lo, hi: lo2, positions: [...range].sort((a, b) => a - b) };
}
