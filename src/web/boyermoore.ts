// Boyer-Moore string search — the matcher that gets FASTER on longer patterns by skipping ahead. The
// trick: align the pattern under the text and compare from the RIGHT end backward. On a mismatch, the
// bad-character rule slides the pattern so the offending text character lines up with its last occurrence
// in the pattern (or jumps the pattern clear past it if it doesn't occur at all). A character the pattern
// never contains lets you leap a whole pattern-length forward without inspecting the skipped text — which
// is why Boyer-Moore is sublinear on typical inputs and is what `grep` uses. (Full Boyer-Moore also adds a
// "good-suffix" rule; we implement the iconic bad-character heuristic, always shifting >= 1 so it stays
// correct.) Reference: Boyer & Moore (CACM 1977); Horspool 1980.

export interface BMStep { align: number; mismatchAt: number; matched: boolean; badChar: string; shift: number }
export interface BMResult { matches: number[]; steps: BMStep[]; comparisons: number; last: Record<string, number> }

/** Last index at which each character appears in the pattern (-1 via the default lookup if absent). */
export function lastOccurrence(pattern: string): Record<string, number> {
  const last: Record<string, number> = {};
  for (let i = 0; i < pattern.length; i++) last[pattern[i]] = i;
  return last;
}

export function search(text: string, pattern: string): BMResult {
  const n = text.length, m = pattern.length;
  const last = lastOccurrence(pattern);
  const matches: number[] = [];
  const steps: BMStep[] = [];
  let comparisons = 0;
  if (m === 0 || m > n) return { matches, steps, comparisons, last };

  let i = 0; // current alignment (pattern starts at text[i])
  while (i <= n - m) {
    let j = m - 1;
    while (j >= 0) { comparisons++; if (text[i + j] !== pattern[j]) break; j--; }
    if (j < 0) {
      matches.push(i);
      steps.push({ align: i, mismatchAt: -1, matched: true, badChar: '', shift: 1 });
      i += 1; // shift by 1 after a full match (bad-char-only) to catch overlaps
    } else {
      const c = text[i + j];
      const shift = Math.max(1, j - (last[c] ?? -1)); // align c with its last occurrence in the pattern
      steps.push({ align: i, mismatchAt: j, matched: false, badChar: c, shift });
      i += shift;
    }
  }
  return { matches, steps, comparisons, last };
}

/** A naive scan's comparison count, for the side-by-side "how much did we save?" contrast. */
export function naiveComparisons(text: string, pattern: string): number {
  const n = text.length, m = pattern.length;
  let comparisons = 0;
  for (let i = 0; i + m <= n; i++) for (let j = 0; j < m; j++) { comparisons++; if (text[i + j] !== pattern[j]) break; }
  return comparisons;
}
