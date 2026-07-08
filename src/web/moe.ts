// Mixture of Experts — how a model can have hundreds of billions of parameters but only spend a fraction per token. An
// MoE layer replaces one feed-forward network with N expert FFNs plus a router. For each token the router scores every
// expert; only the top-k actually run, and their outputs are combined weighted by a softmax over those k scores. So the
// model HAS N experts' worth of parameters but ACTIVATES only k of them — capacity decoupled from compute. The other
// half of the story is load balancing: a router that favours a few experts wastes the rest and bottlenecks the popular
// ones, so training adds a loss that pushes tokens to spread out. This models routing, sparsity, and per-expert load.

// Indices of the k highest scores, most-preferred first.
export function topK(scores: number[], k: number): number[] {
  return scores
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.i);
}

// Softmax over the SELECTED experts' scores (the gate weights the outputs are combined with). Aligned to `selected`.
export function gateWeights(scores: number[], selected: number[]): number[] {
  const picked = selected.map((i) => scores[i]);
  const m = Math.max(...picked);
  const exps = picked.map((s) => Math.exp(s - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export interface Sparsity { activeB: number; totalB: number; pct: number }
// With N experts of `expertParamsB` billion params each and k active per token.
export function sparsity(nExperts: number, k: number, expertParamsB: number): Sparsity {
  const totalB = nExperts * expertParamsB;
  const activeB = k * expertParamsB;
  return { activeB, totalB, pct: Math.round((k / nExperts) * 100) };
}

// Per-expert token count over a batch of routings (each routing is the top-k indices for one token).
export function load(routings: number[][], nExperts: number): number[] {
  const counts = new Array(nExperts).fill(0);
  for (const r of routings) for (const e of r) counts[e]++;
  return counts;
}

// A router is "balanced" when no expert is dramatically busier than the average (imbalance = max/mean < 1.5).
export function imbalance(loads: number[]): number {
  const total = loads.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const mean = total / loads.length;
  return Math.max(...loads) / mean;
}
