// ECMP — Equal-Cost Multi-Path. When a router has several equally-good next-hops to a destination
// (a fat spine-leaf fabric, or two parallel uplinks), it spreads traffic across them. The catch: it
// can't just round-robin packets, or a single TCP flow's packets would arrive out of order. Instead it
// hashes each packet's FLOW identity — the 5-tuple (src IP, dst IP, src port, dst port, protocol) —
// and uses the hash to pick a next-hop. Every packet of one flow hashes the same, so the flow stays on
// ONE path (in order); different flows scatter across paths. The famous failure is POLARIZATION: if
// every router in a multi-tier fabric hashes identically, a flow that goes "left" at tier 1 goes left
// at tier 2 too, so the cross paths starve. The fix is a per-router hash seed. Pure model, tested.

export interface Flow { srcIp: string; dstIp: string; srcPort: number; dstPort: number; proto: string }

const fnv1a = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
// Murmur3 fmix32 finalizer: avalanche all bits so the seed (and every byte) reaches the LOW bits —
// without it, FNV's low bits depend mostly on the trailing bytes, so `% n` would ignore the seed.
const fmix32 = (h: number): number => {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16; return h >>> 0;
};

/** Hash a flow's 5-tuple (salted by a per-router seed) — the value the router spreads on. */
export const hashFlow = (f: Flow, seed: number): number => fmix32(fnv1a(`${seed}|${f.srcIp}|${f.dstIp}|${f.srcPort}|${f.dstPort}|${f.proto}`));

/** Choose one of `n` equal-cost next-hops for a flow. Deterministic ⇒ the whole flow stays on it. */
export const pickPath = (f: Flow, n: number, seed: number): number => hashFlow(f, seed) % n;

/** How many flows land on each of the n paths. */
export function distribute(flows: Flow[], n: number, seed: number): number[] {
  const counts = new Array(n).fill(0);
  for (const f of flows) counts[pickPath(f, n, seed)]++;
  return counts;
}

export interface TwoStage { used: number; total: number; matrix: number[][] }

/** Two cascaded routers (n paths each). With the SAME seed a flow takes the same index at both tiers,
 *  so only the diagonal links carry traffic (polarization). Different seeds light up the full mesh. */
export function twoStageLinks(flows: Flow[], n: number, seed1: number, seed2: number): TwoStage {
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const f of flows) matrix[pickPath(f, n, seed1)][pickPath(f, n, seed2)]++;
  let used = 0;
  for (const row of matrix) for (const c of row) if (c > 0) used++;
  return { used, total: n * n, matrix };
}

/** A spread of test flows (same endpoints, varying source port — the usual entropy source). */
export const makeFlows = (count: number): Flow[] =>
  Array.from({ length: count }, (_, i) => ({ srcIp: '10.0.0.5', dstIp: '10.0.9.9', srcPort: 1024 + i, dstPort: 443, proto: 'TCP' }));
