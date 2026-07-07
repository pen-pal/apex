// Mix networks (Chaum, CACM 1981) — the anonymity primitive that low-latency onion routing is NOT. Tor forwards
// each cell immediately, so an adversary who watches both ends can correlate their TIMING and link sender to
// receiver. A MIX defeats exactly that: it waits until it holds a BATCH of messages, strips one encryption layer
// off each (so nothing can be followed by its bytes), then releases the whole batch in a RANDOM order. Watching a
// mix flush a batch of N, an adversary can do no better than a 1-in-N guess at which output was which input — that
// N is the ANONYMITY SET. Chains of mixes and cover traffic compound it. The cost versus Tor is latency: a message
// waits for its batch to fill. (Chaum 1981; modern designs: Mixminion, Sphinx, Loopix.)
import { mulberry32 } from './reservoir';

export type Msg = { id: number; layers: number; wire: string };

// Each hop re-encrypts, so the bytes on the wire change and can't be followed by content. We derive a short,
// deterministic token per (id, remaining layers) as a stand-in — what's cryptographically real in a mixnet is a
// layered scheme like Sphinx; what's modelled and tested here is the batching, the permutation, and the 1/N metric.
export function wireOf(id: number, layers: number): string {
  const r = mulberry32((id + 1) * 1000 + layers);
  let s = '';
  for (let i = 0; i < 4; i++) s += Math.floor(r() * 256).toString(16).padStart(2, '0');
  return s;
}

export function makeMsg(id: number, layers: number): Msg {
  return { id, layers, wire: wireOf(id, layers) };
}

// Peel one layer: the message advances a hop, so its layer count drops and its on-wire bytes change.
export function peel(m: Msg): Msg {
  const layers = Math.max(0, m.layers - 1);
  return { id: m.id, layers, wire: wireOf(m.id, layers) };
}

// A uniform permutation of [0..n) by Fisher–Yates over a seeded PRNG (deterministic for a given seed).
export function permutation(n: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

// A threshold mix flushes when it holds `inputs.length` messages: peel a layer off each, then emit them shuffled.
// `perm[k]` is the index of the input that became output k — the true wiring the observer cannot see.
export function mixBatch(inputs: Msg[], seed: number): { outputs: Msg[]; perm: number[] } {
  const perm = permutation(inputs.length, seed);
  const outputs = perm.map((i) => peel(inputs[i]));
  return { outputs, perm };
}

// The anonymity set is the batch size; the best an observer can do to link one message is a uniform guess.
export function anonymitySet(batch: number): number {
  return batch;
}
export function linkProbability(batch: number): number {
  return batch > 0 ? 1 / batch : 1;
}
