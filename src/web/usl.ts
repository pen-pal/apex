// Universal Scalability Law (USL) — the model that explains why throwing more workers at a system eventually
// stops helping, and then starts actively HURTING. Amdahl's law already tells you that a serial fraction caps
// speedup: if a fraction of the work can't be parallelized, adding cores gives diminishing returns toward a
// ceiling. The USL (Neil Gunther) adds a second, nastier effect. Real systems don't just serialize — the
// workers also have to COORDINATE: take locks, invalidate each other's caches, gossip state, reconcile. That
// crosstalk grows with the number of PAIRS of workers (∝ N²), so past a point the coordination cost outruns the
// extra capacity and throughput goes RETROGRADE — the curve peaks and comes back down. The formula for relative
// throughput at concurrency N is:
//     C(N) = N / (1 + α(N−1) + βN(N−1))
// where α is the CONTENTION coefficient (serialization — the Amdahl part) and β is the COHERENCY coefficient
// (pairwise coordination — the retrograde part). With β=0 you recover Amdahl (a ceiling of 1/α). With β>0 there
// is an optimal concurrency N* = √((1−α)/β) beyond which adding workers makes things slower — the reason a
// database or thread pool often has a sweet-spot connection/thread count and degrades if you exceed it. Fitting
// α and β to a few load-test points lets you predict the peak before you hit it. Reference: Gunther, "Guerrilla
// Capacity Planning" (the USL).

/** Relative throughput (speedup vs N=1) at concurrency N, given contention α and coherency β. */
export function throughput(n: number, alpha: number, beta: number): number {
  return n / (1 + alpha * (n - 1) + beta * n * (n - 1));
}

/** The concurrency that maximizes throughput: N* = sqrt((1−α)/β). Infinity when β=0 (no retrograde). */
export function peakConcurrency(alpha: number, beta: number): number {
  return beta > 0 ? Math.sqrt((1 - alpha) / beta) : Infinity;
}

/** Amdahl ceiling (β=0 asymptote): throughput can never exceed 1/α. Infinity when α=0. */
export function amdahlCeiling(alpha: number): number {
  return alpha > 0 ? 1 / alpha : Infinity;
}

/** Sample the curve for N = 1..maxN. */
export function curve(alpha: number, beta: number, maxN: number): { n: number; c: number }[] {
  return Array.from({ length: maxN }, (_, i) => ({ n: i + 1, c: throughput(i + 1, alpha, beta) }));
}
