// The phi-accrual failure detector (Hayashibara et al., 2004) — how a distributed system decides a
// peer is dead without a brittle fixed timeout. A node sends heartbeats; the detector watches their
// inter-arrival times, fits a normal distribution to the recent ones, and for the current silence
// outputs a SUSPICION LEVEL phi = -log10(P_later), where P_later is the probability that a heartbeat
// arrives even later than the time we've already waited. phi rises smoothly the longer we wait, and
// — crucially — it ADAPTS: on a jittery link (high variance) the same silence yields a lower phi, so
// the detector tolerates the jitter instead of crying wolf. You act on a threshold (e.g. phi > 8 ≈
// a 1-in-10^8 chance the node is merely slow). This is the detector inside Cassandra, Akka, and
// Hazelcast. Pure, tested against the normal-distribution values the paper's formula prescribes.

/** Abramowitz & Stegun 7.1.26 approximation of the error function (max abs error ~1.5e-7). */
export function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/** Normal CDF: P(X ≤ x) for X ~ N(mu, sigma²). */
export const normalCdf = (x: number, mu: number, sigma: number): number => 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));

export interface Stats { mu: number; sigma: number }
export function stats(samples: number[], minSigma = 1): Stats {
  const n = samples.length;
  if (n === 0) return { mu: 0, sigma: minSigma };
  const mu = samples.reduce((a, b) => a + b, 0) / n;
  const variance = samples.reduce((a, b) => a + (b - mu) ** 2, 0) / n;
  return { mu, sigma: Math.max(minSigma, Math.sqrt(variance)) };
}

/** phi = -log10(P_later(gap)) where P_later(t) = 1 - CDF(t): the unlikelihood of this silence. */
export function phi(gap: number, mu: number, sigma: number): number {
  const pLater = 1 - normalCdf(gap, mu, sigma);
  return -Math.log10(Math.max(pLater, 1e-12)); // clamp so phi stays finite when P_later underflows
}

/** phi at time `now`, using the last `window` inter-arrival gaps of the heartbeat stream. */
export function phiAt(arrivals: number[], now: number, window = 100, minSigma = 1): number {
  const seen = arrivals.filter((t) => t <= now);
  if (seen.length < 2) return 0;
  const intervals: number[] = [];
  for (let i = 1; i < seen.length; i++) intervals.push(seen[i] - seen[i - 1]);
  const s = stats(intervals.slice(-window), minSigma);
  return phi(now - seen[seen.length - 1], s.mu, s.sigma);
}
