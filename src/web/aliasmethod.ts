// The Alias method (Vose) — sample from a weighted discrete distribution in O(1) time per draw, after O(n)
// setup. The naive way (build a cumulative array, draw a uniform, binary-search) is O(log n) per sample and
// awkward to update. The alias method is cleverer: it chops the n weights into exactly n "buckets" each of
// equal total probability 1/n, where each bucket is at most TWO outcomes — a primary and an "alias". To
// sample you roll one n-sided die to pick a bucket, then flip one biased coin to choose the bucket's primary
// or its alias. Two O(1) lookups, done. The magic is the setup: repeatedly pair an under-full outcome
// (weight < average) with an over-full one, letting the over-full one donate its excess as the under-full
// one's alias. Used in Monte-Carlo sampling, weighted load balancing, population genetics, and procedural
// generation. Reference: Walker (1977); Vose (1991).

export interface AliasTable { prob: number[]; alias: number[]; n: number }

/** Build the alias table from non-negative weights (need not sum to 1). O(n). */
export function buildAlias(weights: number[]): AliasTable {
  const n = weights.length;
  const total = weights.reduce((a, b) => a + b, 0);
  const scaled = weights.map((w) => (w * n) / total); // scale so the average weight is exactly 1
  const prob = new Array(n).fill(0);
  const alias = new Array(n).fill(0);

  const small: number[] = [], large: number[] = [];
  scaled.forEach((s, i) => (s < 1 ? small : large).push(i));

  while (small.length && large.length) {
    const s = small.pop()!, l = large.pop()!;
    prob[s] = scaled[s];         // bucket s is filled to scaled[s] by outcome s…
    alias[s] = l;                // …and the rest by outcome l
    scaled[l] = scaled[l] - (1 - scaled[s]); // l donates that slice; recompute its remaining mass
    (scaled[l] < 1 ? small : large).push(l);
  }
  // leftovers are exactly full (floating point drift aside)
  while (large.length) prob[large.pop()!] = 1;
  while (small.length) prob[small.pop()!] = 1;
  return { prob, alias, n };
}

/** Draw a sample given a bucket index (0..n-1) and a coin in [0,1): take the bucket's primary or its alias. */
export function sample(t: AliasTable, bucket: number, coin: number): number {
  return coin < t.prob[bucket] ? bucket : t.alias[bucket];
}

/** The effective probability the table assigns to outcome j — for verification. Bucket j contributes prob[j]
 *  to j, and every bucket i whose alias is j contributes (1 − prob[i]); each bucket is weighted 1/n. */
export function effectiveProbability(t: AliasTable, j: number): number {
  let p = t.prob[j];
  for (let i = 0; i < t.n; i++) if (i !== j && t.alias[i] === j) p += 1 - t.prob[i];
  return p / t.n;
}
