// HdrHistogram — how you record latencies and read back p50/p99/p99.9 without storing every sample. The
// naive way (keep all values, sort, index) costs O(n) memory and is hopeless at scale. A plain fixed-bucket
// histogram either wastes resolution on the common small values or can't reach the rare huge ones. HDR
// ("High Dynamic Range") uses LOG-LINEAR buckets: split the value range into power-of-two octaves, and each
// octave into S equal sub-buckets. That gives CONSTANT RELATIVE error (~1/S) across the whole range — 3%
// resolution whether the value is 10µs or 10s — with memory that grows only with the range, not the sample
// count. Record is O(1), any percentile is a cheap scan. It's the standard for latency measurement (wrk2,
// JMH, Cassandra, Kafka). Reference: Gil Tene's HdrHistogram.

/** Relative error bound for S sub-buckets per octave: a value is stored within a factor (1 + 1/S). */
export const relativeError = (S: number): number => 1 / S;

/** Snap a value down to its bucket's lower bound. Within octave [2^m, 2^{m+1}) the sub-bucket width is
 *  2^m / S, so the rounding error is < value/S — a constant relative error, independent of magnitude. */
export function quantize(v: number, S: number): number {
  if (v <= 0) return 0;
  const m = Math.floor(Math.log2(v));
  const step = Math.max(1, Math.pow(2, m) / S); // sub-bucket width in this octave (>=1 for small values)
  return Math.floor(v / step) * step;
}

export interface Bucket { lo: number; count: number }

/** A recording latency histogram with ~1/S relative error. */
export class HdrHist {
  private counts = new Map<number, number>();
  private total = 0;
  constructor(private S = 8) {}

  record(v: number): void {
    const q = quantize(v, this.S);
    this.counts.set(q, (this.counts.get(q) ?? 0) + 1);
    this.total++;
  }

  count(): number { return this.total; }
  /** Distinct buckets in use — the memory footprint, bounded by (octaves × S), NOT by sample count. */
  bucketCount(): number { return this.counts.size; }

  /** The value at percentile p (0–100): the bucket lower bound where the cumulative count first crosses p%. */
  percentile(p: number): number {
    if (this.total === 0) return 0;
    const target = (p / 100) * this.total;
    const keys = [...this.counts.keys()].sort((a, b) => a - b);
    let cum = 0;
    for (const k of keys) { cum += this.counts.get(k)!; if (cum >= target) return k; }
    return keys[keys.length - 1];
  }

  buckets(): Bucket[] {
    return [...this.counts.entries()].map(([lo, count]) => ({ lo, count })).sort((a, b) => a.lo - b.lo);
  }
}
