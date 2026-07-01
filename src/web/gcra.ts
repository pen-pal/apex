// GCRA — the Generic Cell Rate Algorithm, a rate limiter that needs just ONE number of state per client. It began
// life policing ATM network cells and is now the engine behind Redis's throttling (the redis-cell module) and
// many API gateways, because it does what a token bucket does with none of the bucket. A token bucket tracks a
// running count of tokens and refills it over time; GCRA instead tracks a single timestamp — the TAT, or
// "Theoretical Arrival Time," meaning "the earliest instant at which a perfectly-paced client should send its
// next request." Two parameters define the limit: the emission interval T = 1/rate (the ideal spacing between
// requests) and a tolerance τ (how far ahead of schedule a burst may run). A request arriving at time t is
// allowed exactly when t ≥ TAT − τ; if it is, the TAT jumps forward to max(t, TAT) + T. Fall behind schedule and
// the TAT stays put, so idle time silently "banks" burst capacity up to τ; run too fast and the TAT races past
// your clock until t < TAT − τ and you're throttled — and TAT − τ − t is precisely the Retry-After you should
// return. It is mathematically identical to a token bucket of capacity ⌊τ/T⌋+1 refilling one token every T, but
// carries no counter to increment on every tick: the passage of time IS the refill, encoded in the gap between
// now and the TAT. That O(1)-space, no-background-timer property is why it scales to millions of keys in a
// single Redis value. This models the TAT update, the allow/deny decision, and the retry-after. Reference:
// ITU-T I.371 (GCRA); the redis-cell / throttled implementations.

export interface Decision { t: number; allow: boolean; tat: number; retryAfter: number }

/** Requests allowed in an initial burst from an idle state: ⌊τ/T⌋ + 1. */
export const burstCapacity = (T: number, tau: number): number => Math.floor(tau / T) + 1;

/** Run a stream of request arrival times through GCRA(T, τ). TAT starts at 0 (fully idle). */
export function simulate(times: number[], T: number, tau: number, tat0 = 0): Decision[] {
  let tat = tat0;
  const out: Decision[] = [];
  for (const t of times) {
    const allowAt = tat - tau;               // earliest time this request may arrive
    if (t < allowAt) {
      out.push({ t, allow: false, tat, retryAfter: allowAt - t }); // throttled; TAT unchanged
    } else {
      tat = Math.max(t, tat) + T;            // advance the schedule
      out.push({ t, allow: true, tat, retryAfter: 0 });
    }
  }
  return out;
}

/** The sustained rate GCRA(T, τ) permits over the long run: one request per T. */
export const sustainedRatePerSec = (T: number): number => 1 / T;
