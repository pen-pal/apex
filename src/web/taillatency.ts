// Tail latency — why the AVERAGE response time is a lie at scale, and why one slow server can wreck a
// whole request. Two ideas, both exactly computable. (1) Percentiles: p99 is the latency 99% of requests
// beat; it can be many times the median, and it's what users actually feel. (2) Fan-out amplification:
// if a request must wait for ALL of N independent servers, and each is slow with probability p, the
// request is slow with probability 1−(1−p)^N — so a "rare" 1%-tail per server becomes near-certain once
// you fan out to 100 of them. The fix is tail tolerance: hedged requests (send a backup copy, take the
// first to answer) drive the per-server slow probability from p to ~p². Reference: Dean & Barroso,
// "The Tail at Scale" (CACM 2013).

/** Nearest-rank percentile: the smallest sample value that at least p% of the data is ≤. p in [0,100]. */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return NaN;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}

export const mean = (s: number[]) => (s.length ? s.reduce((a, x) => a + x, 0) / s.length : NaN);

/** P(request is slow) when it must wait for ALL n independent servers, each slow with probability p. */
export const fanoutTail = (p: number, n: number) => 1 - Math.pow(1 - p, n);

/** Hedged requests: send `copies` independent attempts and take the fastest, so a single server's slow
 *  probability p becomes p^copies — then fan that reduced probability out across n servers. */
export const hedgedTail = (p: number, n: number, copies: number) => 1 - Math.pow(1 - Math.pow(p, copies), n);

/** A deterministic, reproducible latency sample: a fast lognormal-ish body plus a heavy tail of spikes.
 *  `tailPct` percent of requests are slow (multiplied up), so the distribution is tunable but seed-free. */
export function sampleLatencies(count: number, baseMs: number, tailPct: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    // deterministic pseudo-noise from i (no RNG): a smooth body in [0.6, 1.8]× base
    const body = baseMs * (0.6 + 1.2 * (0.5 + 0.5 * Math.sin(i * 1.2 + 1)) * (0.5 + 0.5 * Math.cos(i * 0.7)));
    const isSlow = (i * 7 + 3) % 100 < tailPct;            // every ~(100/tailPct)-th request spikes
    out.push(Math.round(isSlow ? body + baseMs * (4 + ((i * 13) % 6)) : body));
  }
  return out;
}
