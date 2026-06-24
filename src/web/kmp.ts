// Knuth-Morris-Pratt string matching (1977) — find a pattern in text in O(n+m), never
// re-examining a text character. A naive search, on a mismatch, slides the pattern one
// step and re-compares from scratch — O(n·m). KMP precomputes a FAILURE FUNCTION (the
// prefix function π): π[i] = the length of the longest proper prefix of pattern[0..i] that
// is also a suffix. On a mismatch after matching k characters, instead of backing up the
// text, it slides the pattern so the already-matched prefix π[k-1] lines up — because those
// characters are guaranteed to match. The text pointer only ever moves forward. Pure,
// tested (against a naive matcher and hand-worked failure tables).

/** The prefix function π over the pattern. */
export function failure(pattern: string): number[] {
  const pi = new Array(pattern.length).fill(0);
  let k = 0; // length of the current longest prefix-suffix
  for (let i = 1; i < pattern.length; i++) {
    while (k > 0 && pattern[i] !== pattern[k]) k = pi[k - 1]; // fall back along the chain
    if (pattern[i] === pattern[k]) k++;
    pi[i] = k;
  }
  return pi;
}

export interface Step { textIndex: number; patIndex: number; match: boolean; jumpedTo: number | null }
export interface SearchResult { matches: number[]; steps: Step[]; comparisons: number }

/** Find every occurrence of `pattern` in `text`, recording each comparison. */
export function search(text: string, pattern: string): SearchResult {
  const pi = failure(pattern);
  const matches: number[] = [];
  const steps: Step[] = [];
  if (pattern.length === 0) return { matches, steps, comparisons: 0 };
  let q = 0, comparisons = 0;
  for (let i = 0; i < text.length; i++) {
    while (q > 0 && text[i] !== pattern[q]) { comparisons++; const to = pi[q - 1]; steps.push({ textIndex: i, patIndex: q, match: false, jumpedTo: to }); q = to; }
    comparisons++;
    const m = text[i] === pattern[q];
    steps.push({ textIndex: i, patIndex: q, match: m, jumpedTo: null });
    if (m) q++;
    if (q === pattern.length) { matches.push(i - q + 1); q = pi[q - 1]; } // found one; slide for overlaps
  }
  return { matches, steps, comparisons };
}

/** Naive O(n·m) matcher, for cross-checking. */
export function naiveSearch(text: string, pattern: string): number[] {
  const out: number[] = [];
  if (!pattern) return out;
  for (let i = 0; i + pattern.length <= text.length; i++) {
    let j = 0;
    while (j < pattern.length && text[i + j] === pattern[j]) j++;
    if (j === pattern.length) out.push(i);
  }
  return out;
}
