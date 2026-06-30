// Leaky bucket — traffic shaping that turns a bursty arrival stream into a perfectly smooth output.
// Picture a bucket with a hole: packets pour in (and spill over if it's already full), but they only
// drain out at a fixed rate, no matter how they arrived. The output is therefore constant — the bucket
// absorbs bursts up to its capacity and DROPS whatever overflows. This is the opposite trade-off from
// the token bucket (the existing rate-limit section): a token bucket SAVES up allowance so it can let a
// later burst through, whereas a leaky bucket never bursts — it enforces a hard, even rate. Shapers in
// routers and QoS schedulers use it to police a flow to its contracted rate. Reference: Turner 1986
// ("New directions in communications"); Tanenbaum, Computer Networks (traffic shaping).

export interface Tick { t: number; arrived: number; admitted: number; dropped: number; output: number; level: number }

/** Simulate the bucket over `arrivals` (packets arriving each tick): admit up to remaining capacity
 *  (dropping overflow), then leak at a constant `leakRate`. Output is the leak — smooth by construction. */
export function leakyBucket(arrivals: number[], capacity: number, leakRate: number): Tick[] {
  const out: Tick[] = [];
  let level = 0;
  for (let t = 0; t < arrivals.length; t++) {
    const a = arrivals[t];
    const space = capacity - level;
    const admitted = Math.max(0, Math.min(a, space));
    const dropped = a - admitted;
    level += admitted;
    const output = Math.min(level, leakRate); // constant drain, capped by what's in the bucket
    level -= output;
    out.push({ t, arrived: a, admitted, dropped, output, level });
  }
  return out;
}

export const totalDropped = (ticks: Tick[]) => ticks.reduce((a, t) => a + t.dropped, 0);
export const totalOutput = (ticks: Tick[]) => ticks.reduce((a, t) => a + t.output, 0);
/** The largest single-tick output — for a leaky bucket this never exceeds the leak rate (it can't burst). */
export const peakOutput = (ticks: Tick[]) => ticks.reduce((m, t) => Math.max(m, t.output), 0);
