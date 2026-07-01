// Fisher–Yates shuffle — the right way to shuffle an array, and the one-character bug that makes the popular
// "naive" version subtly, provably biased. The correct algorithm walks from the last index down and swaps each
// element with a random one at or BEFORE it (index j in [0, i]); this produces each of the n! orderings with
// exactly equal probability. The naive version people reach for — walk every index i and swap it with a random
// index anywhere in [0, n−1] — looks just as random but isn't: it makes n choices of n options each, so n^n
// equally-likely execution paths, and n^n is almost never divisible by n!, so the paths CAN'T map evenly onto
// the n! orderings. Some permutations come up more than others. You can't see it by eye — you see it by
// running the shuffle millions of times and tallying where each value lands. This models both and measures the
// bias. Reference: Fisher & Yates (1938); Knuth (TAOCP vol. 2); the classic "how to shuffle" write-ups.

export type RNG = () => number; // returns a float in [0, 1)

/** A tiny deterministic PRNG (LCG) so results are reproducible — no Math.random. */
export function makeRng(seed: number): RNG {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/** Correct: each i swaps with a random index in [0, i]. Uniform over all n! permutations. */
export function fisherYates(arr: number[], rng: RNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); // 0..i
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Naive (biased): each i swaps with a random index in [0, n-1]. Looks random, isn't uniform. */
export function naiveShuffle(arr: number[], rng: RNG): void {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    const j = Math.floor(rng() * n); // 0..n-1  ← the bug
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export const isPermutation = (arr: number[]): boolean => {
  const seen = new Set(arr);
  return seen.size === arr.length && arr.every((v) => v >= 0 && v < arr.length);
};

/** Run a shuffle `trials` times over [0..n-1] and return matrix[position][value] = probability it landed there. */
export function distribution(shuffle: (a: number[], r: RNG) => void, n: number, trials: number, rng: RNG): number[][] {
  const counts = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let t = 0; t < trials; t++) {
    const arr = Array.from({ length: n }, (_, i) => i);
    shuffle(arr, rng);
    for (let pos = 0; pos < n; pos++) counts[pos][arr[pos]]++;
  }
  return counts.map((row) => row.map((c) => c / trials));
}

/** Largest relative deviation of any cell from the uniform ideal 1/n (0 = perfectly uniform). */
export function maxBias(matrix: number[][], n: number): number {
  const ideal = 1 / n;
  let m = 0;
  for (const row of matrix) for (const p of row) m = Math.max(m, Math.abs(p - ideal) / ideal);
  return m;
}
