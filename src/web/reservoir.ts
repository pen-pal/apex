// Reservoir sampling (Algorithm R, Vitter 1985) — pick k items uniformly at random from a
// stream of UNKNOWN, possibly unbounded length, in one pass using only O(k) memory. You
// can't store the whole stream and you don't know n in advance, yet every item must end up
// with the same probability k/n of being kept. The trick: keep the first k items, then for
// the i-th item (i > k) keep it with probability k/i, and if kept, have it evict a uniformly
// random one of the current k. A short induction shows this keeps every item with probability
// exactly k/n at all times. It's how you sample log lines, pick a random row while scanning,
// or A/B-bucket an unbounded event stream. The randomness is injected so the mechanics are
// testable; the uniformity is the statistical payoff.

export interface Step { index: number; value: number; kept: boolean; evicted: number | null }
export interface Result { reservoir: number[]; steps: Step[] }

/** @param rand a () => [0,1) source (injected for determinism). */
export function sample(stream: number[], k: number, rand: () => number): Result {
  const reservoir: number[] = [];
  const steps: Step[] = [];
  for (let i = 0; i < stream.length; i++) {
    const v = stream[i];
    if (i < k) { reservoir.push(v); steps.push({ index: i, value: v, kept: true, evicted: null }); continue; }
    const j = Math.floor(rand() * (i + 1)); // uniform in [0, i]
    if (j < k) { const evicted = reservoir[j]; reservoir[j] = v; steps.push({ index: i, value: v, kept: true, evicted }); }
    else steps.push({ index: i, value: v, kept: false, evicted: null });
  }
  return { reservoir, steps };
}

/** Mulberry32 PRNG — a tiny seedable generator so tests are reproducible. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
