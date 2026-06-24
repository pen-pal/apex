// Retry resilience — backoff, jitter, and the circuit breaker. When an upstream fails, a naive
// client retries immediately, and a whole FLEET retrying in lockstep becomes a thundering herd that
// keeps the upstream down. Two mechanisms fix this. (1) BACKOFF + JITTER: wait exponentially longer
// between tries, and randomize the wait so the fleet de-synchronizes — AWS's "full jitter" picks a
// delay uniformly in [0, base·2^attempt]. (2) CIRCUIT BREAKER: stop hammering a known-dead upstream
// at all — after N consecutive failures the breaker trips OPEN and fails fast, sheds load while the
// upstream heals, then after a cooldown goes HALF-OPEN to probe with a single trial before closing.
// Both models are deterministic (seeded), so the visualization is exactly reproducible. Tested.

// ---- backoff & jitter ---------------------------------------------------------------------------

export type Strategy = 'none' | 'fixed' | 'exp' | 'jitter';

/** A tiny deterministic LCG (so jitter is reproducible and testable). */
export function lcg(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

/** The delay before retry #`attempt`. Exp = base·2^attempt capped; jitter = uniform [0, that]. */
export function backoffDelay(strategy: Strategy, attempt: number, baseMs: number, capMs: number, rnd: () => number): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  if (strategy === 'none') return 0;
  if (strategy === 'fixed') return baseMs;
  if (strategy === 'exp') return exp;
  return Math.floor(rnd() * (exp + 1)); // AWS "full jitter": uniform in [0, exp]
}

export interface FleetResult {
  strategy: Strategy;
  buckets: number[]; // retry attempts per time bucket across the whole fleet
  bucketMs: number;
  peak: number; // busiest bucket overall
  retryPeak: number; // busiest bucket counting only RETRIES (attempt ≥ 1) — the retry-wave height
  total: number; // total attempts the upstream had to field
}

export interface FleetOpts {
  clients: number; baseMs: number; capMs: number; healMs: number;
  maxAttempts: number; horizonMs: number; bucketMs: number; seed: number;
}

/** Simulate a fleet that all fails at t=0 and retries under `strategy`, until the upstream heals. */
export function simulateFleet(strategy: Strategy, o: FleetOpts): FleetResult {
  const nb = Math.floor(o.horizonMs / o.bucketMs) + 1;
  const buckets = new Array(nb).fill(0);
  const retryBuckets = new Array(nb).fill(0); // counts ONLY retries (attempt ≥ 1), wherever they land
  let total = 0;
  for (let c = 0; c < o.clients; c++) {
    const rnd = lcg(o.seed + c * 7919);
    let t = 0, a = 0;
    while (a < o.maxAttempts && t <= o.horizonMs) {
      const b = Math.floor(t / o.bucketMs);
      if (b < nb) { buckets[b]++; if (a >= 1) retryBuckets[b]++; }
      total++;
      if (t >= o.healMs) break; // upstream healed → this attempt succeeds, client stops
      t += backoffDelay(strategy, a, o.baseMs, o.capMs, rnd);
      a++;
    }
  }
  // retryPeak counts retries honestly (a jittered first retry can fall in bucket 0 — it's still counted)
  return { strategy, buckets, bucketMs: o.bucketMs, peak: Math.max(...buckets), retryPeak: Math.max(0, ...retryBuckets), total };
}

// ---- circuit breaker (Nygard / Hystrix three-state machine) -------------------------------------

export type BreakerState = 'closed' | 'open' | 'half-open';
export interface BreakerCfg { failThreshold: number; cooldownMs: number }
export interface Req { t: number; upstream: 'success' | 'failure' } // what the upstream WOULD return if asked
export interface BreakerStep { t: number; state: BreakerState; allowed: boolean; result: 'success' | 'failure' | 'shed'; nextState: BreakerState }

/** Drive the breaker over a request trace. CLOSED counts failures→OPEN; OPEN fails fast until the
 *  cooldown elapses→HALF-OPEN; HALF-OPEN's single trial closes on success or re-opens on failure. */
export function runBreaker(reqs: Req[], cfg: BreakerCfg): BreakerStep[] {
  let state: BreakerState = 'closed';
  let fails = 0;
  let openedAt = 0;
  const steps: BreakerStep[] = [];
  for (const req of reqs) {
    if (state === 'open' && req.t - openedAt >= cfg.cooldownMs) state = 'half-open'; // cooldown elapsed → probe
    const before = state;
    let allowed: boolean, result: BreakerStep['result'], next: BreakerState = state;
    if (state === 'open') {
      allowed = false; result = 'shed'; next = 'open'; // fail fast, shed load
    } else if (state === 'half-open') {
      allowed = true; result = req.upstream;
      next = req.upstream === 'success' ? 'closed' : 'open';
      if (next === 'open') openedAt = req.t;
      fails = 0;
    } else { // closed
      allowed = true; result = req.upstream;
      if (req.upstream === 'failure') { fails++; if (fails >= cfg.failThreshold) { next = 'open'; openedAt = req.t; fails = 0; } }
      else fails = 0;
    }
    steps.push({ t: req.t, state: before, allowed, result, nextState: next });
    state = next;
  }
  return steps;
}
