// Convolutional coding + Viterbi decoding — forward error correction that fixes bit errors without
// any retransmission, the workhorse behind deep-space links, GSM, 802.11, and satellite TV. We use
// the textbook rate-1/2, constraint-length K=3 code with generator polynomials G1=111₂ (7 octal)
// and G2=101₂ (5 octal). The encoder is a 2-bit shift register: each input bit produces TWO output
// bits, so redundancy is spread across time. The decoder (Viterbi, 1967) finds the single most
// likely transmitted bit-sequence by walking a trellis of the 4 encoder states and, at every step,
// keeping only the lowest-Hamming-distance survivor path into each state — dynamic programming over
// the most-likely path. With free distance d_free=5 this code corrects up to 2 bit errors per run.
// Honest model: the encoder bits are hand-derived from the generators; the decoder is independent.

export const STATES = [0, 1, 2, 3]; // each is the 2 previous input bits: bit1 = m1 (newer), bit0 = m2 (older)

/** One encoder step from `state` on input `u`: returns the 2 output bits and the next state. */
export function encStep(state: number, u: number): { out: [number, number]; next: number } {
  const m1 = (state >> 1) & 1, m2 = state & 1;
  const o1 = u ^ m1 ^ m2; // G1 = 111 → taps on u, m1, m2
  const o2 = u ^ m2; //      G2 = 101 → taps on u, m2
  const next = ((u << 1) | m1) & 3; // shift u in: new m1 = u, new m2 = old m1
  return { out: [o1, o2], next };
}

export interface Encoded {
  codeword: number[]; // 2 bits per input (message + 2 flush zeros)
  transitions: { from: number; u: number; out: [number, number]; to: number }[];
}

/** Encode a message, appending K-1=2 zero "flush" bits so the trellis terminates in state 0. */
export function encode(msg: number[]): Encoded {
  const bits = [...msg, 0, 0];
  let state = 0;
  const codeword: number[] = [];
  const transitions: Encoded['transitions'] = [];
  for (const u of bits) {
    const { out, next } = encStep(state, u);
    codeword.push(out[0], out[1]);
    transitions.push({ from: state, u, out, to: next });
    state = next;
  }
  return { codeword, transitions };
}

export interface Edge { from: number; to: number; u: number; out: [number, number]; bm: number; survivor: boolean; ml: boolean }
export interface Stage { t: number; r: [number, number]; edges: Edge[]; metricAfter: (number | null)[] }
export interface Decoded {
  decoded: number[]; // recovered message (flush bits stripped)
  reencoded: number[]; // the codeword the survivor path implies
  corrections: number[]; // indices where the received word differed from the survivor codeword
  stages: Stage[]; // full trellis for visualization
  endState: number; // traceback start (should be 0 thanks to flushing)
}

const INF = Infinity;

/** Hard-decision Viterbi decode of a received bit stream (length 2·stages). */
export function decode(received: number[]): Decoded {
  const T = Math.floor(received.length / 2);
  let metric: number[] = [0, INF, INF, INF]; // start in state 0
  const survAll: ({ prev: number; u: number } | null)[][] = [];
  const stages: Stage[] = [];

  for (let t = 0; t < T; t++) {
    const r: [number, number] = [received[2 * t], received[2 * t + 1]];
    const nm = [INF, INF, INF, INF];
    const surv: ({ prev: number; u: number } | null)[] = [null, null, null, null];
    const edges: Edge[] = [];
    for (const s of STATES) {
      for (const u of [0, 1]) {
        const { out, next } = encStep(s, u);
        const bm = (out[0] ^ r[0]) + (out[1] ^ r[1]); // branch metric = Hamming(expected, received)
        const cand = metric[s] === INF ? INF : metric[s] + bm;
        let survivor = false;
        if (cand < nm[next]) { nm[next] = cand; surv[next] = { prev: s, u }; survivor = true; }
        edges.push({ from: s, to: next, u, out, bm, survivor: false, ml: false });
        // mark survivor flag after the fact below (a later better edge can demote this one)
        void survivor;
      }
    }
    // recompute which edge is the actual survivor into each `to` (lowest cand, deterministic)
    for (const e of edges) {
      const cand = metric[e.from] === INF ? INF : metric[e.from] + e.bm;
      e.survivor = surv[e.to] != null && surv[e.to]!.prev === e.from && surv[e.to]!.u === e.u && cand === nm[e.to];
    }
    survAll.push(surv);
    stages.push({ t, r, edges, metricAfter: nm.map((m) => (m === INF ? null : m)) });
    metric = nm;
  }

  // traceback from state 0 (flushing guarantees we end there)
  let state = 0;
  const dec: number[] = [];
  const mlEdge: { t: number; from: number; to: number; u: number }[] = [];
  for (let t = T - 1; t >= 0; t--) {
    const e = survAll[t][state];
    if (!e) break;
    dec.unshift(e.u);
    mlEdge.unshift({ t, from: e.prev, to: state, u: e.u });
    state = e.prev;
  }
  // flag the ML path edges in the stages
  for (const m of mlEdge) {
    const st = stages[m.t];
    const edge = st.edges.find((e) => e.from === m.from && e.to === m.to && e.u === m.u);
    if (edge) edge.ml = true;
  }

  const decoded = dec.slice(0, Math.max(0, dec.length - 2)); // strip the 2 flush bits
  const reencoded = encode(decoded).codeword;
  const corrections: number[] = [];
  for (let i = 0; i < Math.min(received.length, reencoded.length); i++) if (received[i] !== reencoded[i]) corrections.push(i);

  return { decoded, reencoded, corrections, stages, endState: state };
}
