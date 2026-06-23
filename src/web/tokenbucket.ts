// Token-bucket rate limiting — how an API caps your request rate while still
// allowing short bursts. A bucket holds up to C tokens and gains R tokens each tick
// (never above C). Every request must take one token: if the bucket is non-empty
// it's allowed, otherwise it's rejected (HTTP 429). So you can burst up to C
// requests instantly (a full bucket), but the long-run rate can't exceed R — the
// refill rate. This is the generic algorithm behind most rate limiters. Pure, tested.

export interface BucketConfig {
  capacity: number; // C: max tokens (the burst size)
  refill: number; // R: tokens added per tick (the sustained rate)
  ticks: number;
  arrivals: number[] | number; // requests per tick (array or constant)
  initialTokens?: number; // default: full bucket
}

export interface BucketTick {
  t: number;
  tokensStart: number; // tokens before refill
  refilled: number; // tokens actually added (capped at capacity)
  arrived: number; // requests this tick
  allowed: number; // requests that got a token
  rejected: number; // requests with no token (429)
  tokensEnd: number; // tokens left after serving
}

/** Simulate the bucket over time. Refill happens first, then requests are served. */
export function simulateBucket(cfg: BucketConfig): BucketTick[] {
  const arrivalsAt = (t: number) => (Array.isArray(cfg.arrivals) ? cfg.arrivals[t] ?? 0 : cfg.arrivals);
  let tokens = cfg.initialTokens ?? cfg.capacity;
  const out: BucketTick[] = [];

  for (let t = 0; t < cfg.ticks; t++) {
    const tokensStart = tokens;
    const refilled = Math.min(cfg.refill, cfg.capacity - tokens); // never overflow the bucket
    tokens += refilled;

    const arrived = arrivalsAt(t);
    const allowed = Math.min(arrived, tokens); // each allowed request spends a token
    tokens -= allowed;
    const rejected = arrived - allowed;

    out.push({ t, tokensStart, refilled, arrived, allowed, rejected, tokensEnd: tokens });
  }
  return out;
}

export interface BucketStats {
  totalArrived: number;
  totalAllowed: number;
  totalRejected: number;
  acceptRate: number; // fraction allowed
}

export function bucketStats(trace: BucketTick[]): BucketStats {
  const totalArrived = trace.reduce((s, x) => s + x.arrived, 0);
  const totalAllowed = trace.reduce((s, x) => s + x.allowed, 0);
  const totalRejected = trace.reduce((s, x) => s + x.rejected, 0);
  return { totalArrived, totalAllowed, totalRejected, acceptRate: totalArrived ? totalAllowed / totalArrived : 1 };
}
