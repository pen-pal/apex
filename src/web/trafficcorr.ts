// End-to-end traffic correlation — the attack that sets the ceiling on low-latency anonymity (Tor). An adversary who
// can OBSERVE traffic entering the network near the client AND leaving it near the destination doesn't need to break
// any encryption: the two flows carry the same shape over time (the same bursts and gaps), so a statistical
// correlation links them. This is why Tor cannot defend against a global passive adversary, and why the defense —
// constant-rate COVER TRAFFIC — costs bandwidth: pad every flow to a flat rate and the tell-tale shape disappears.
// (Danezis/Murdoch on Tor traffic analysis; the property mix networks buy with batching + delay.)

// Pearson correlation of two equal-length series, in [-1, 1]. If either series has no variance (e.g. a constant,
// padded flow), there is no shape to match, so correlation is undefined — we report 0 (nothing to link on).
export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n === 0 || b.length !== n) return 0;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va === 0 || vb === 0) return 0;
  return cov / Math.sqrt(va * vb);
}

// Constant-rate cover traffic: send a fixed number of cells every slot regardless of the real payload, so every
// observer sees a flat line with no shape. `rate` defaults to the flow's peak, i.e. enough headroom to hide it.
export function constantRatePad(flow: number[], rate?: number): number[] {
  const r = rate ?? Math.max(1, ...flow);
  return flow.map(() => r);
}

// The adversary links two observed flows when their correlation clears a threshold. Real Tor traffic-analysis papers
// achieve very high confidence; 0.8 is a reasonable illustrative bar.
export function links(entry: number[], exit: number[], threshold = 0.8): boolean {
  return pearson(entry, exit) >= threshold;
}

// Given the target's entry flow and several candidate exit flows, the adversary's best guess is the most-correlated
// one. Returns its index and score (or -1 if nothing clears the threshold — the attack fails).
export function bestMatch(entry: number[], exits: number[][], threshold = 0.8): { index: number; score: number } {
  let index = -1, score = -Infinity;
  exits.forEach((e, i) => { const r = pearson(entry, e); if (r > score) { score = r; index = i; } });
  return score >= threshold ? { index, score } : { index: -1, score };
}
