// DDSketch — a streaming quantile sketch (Datadog's, hence the name) that answers "what's my p99 latency?" with
// a guaranteed RELATIVE error, using tiny memory and merging cleanly across machines. The tension it resolves:
// exact percentiles need all the data (huge), and naive fixed-width histograms give you ABSOLUTE error — a
// 10ms-wide bucket is fine at 5ms but useless at 5s. Latency spans many orders of magnitude, so what you
// actually want is relative accuracy: "p99 is 2.0s ± 1%," equally tight at 5ms and 5s. DDSketch gets that with
// one idea: LOGARITHMIC bucket boundaries. Pick a relative accuracy α (say 1%), set γ = (1+α)/(1-α), and map a
// value v to bucket i = ⌈log_γ v⌉ — so consecutive bucket edges are a constant FACTOR γ apart, not a constant
// distance. Every value in bucket i is within α (relatively) of the bucket's representative x = 2γ^i/(γ+1), so
// any quantile read back from the counts is guaranteed within α of the true value. Because latencies cluster
// over a bounded range of magnitudes, you only need a few hundred buckets to cover microseconds-to-minutes. And
// since a sketch is just a map of bucket→count, two sketches MERGE by adding counts — so every server keeps its
// own and a collector sums them into a global p99 without ever shipping raw samples. This models the sketch,
// its quantiles, the error guarantee, and merging. Reference: Masson, Rim, Lee, "DDSketch" (VLDB 2019).

export class DDSketch {
  readonly alpha: number;
  readonly gamma: number;
  buckets = new Map<number, number>();   // bucket index → count
  count = 0;

  constructor(alpha: number) { this.alpha = alpha; this.gamma = (1 + alpha) / (1 - alpha); }

  /** The bucket index for a positive value: ⌈log_γ v⌉. */
  key(v: number): number { return Math.ceil(Math.log(v) / Math.log(this.gamma)); }

  /** The representative value of a bucket — within α (relative) of every value that maps to it. */
  representative(i: number): number { return (2 * Math.pow(this.gamma, i)) / (this.gamma + 1); }

  add(v: number): void {
    if (v <= 0) return;                  // this sketch covers positive values (latencies, sizes)
    const i = this.key(v);
    this.buckets.set(i, (this.buckets.get(i) ?? 0) + 1);
    this.count++;
  }

  /** Estimate the q-quantile (0..1) with relative error ≤ α. */
  quantile(q: number): number {
    if (this.count === 0) return NaN;
    const rank = Math.max(1, Math.ceil(q * this.count));   // 1-indexed target rank
    const keys = [...this.buckets.keys()].sort((a, b) => a - b);
    let cum = 0;
    for (const i of keys) { cum += this.buckets.get(i)!; if (cum >= rank) return this.representative(i); }
    return this.representative(keys[keys.length - 1]);
  }

  /** Merge another sketch (same α) into this one — just add bucket counts. */
  merge(other: DDSketch): void {
    for (const [i, c] of other.buckets) this.buckets.set(i, (this.buckets.get(i) ?? 0) + c);
    this.count += other.count;
  }

  /** Number of buckets — the memory footprint, independent of how many values were added. */
  get size(): number { return this.buckets.size; }
}

/** Exact quantile of an array — the ground truth (nearest-rank). */
export function exactQuantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(q * s.length));
  return s[rank - 1];
}
