// 802.11 CSMA/CA — how WiFi stations share one half-duplex channel without a
// referee. A station with a frame waits for the channel to be idle (a DIFS), then
// picks a random backoff in [0, CW] and counts down one slot per idle slot, FREEZING
// while someone else transmits. Whoever reaches 0 first seizes the channel; the
// receiver returns an ACK = success. If two stations hit 0 in the SAME slot they
// collide (no ACK), DOUBLE their contention window (binary exponential backoff) and
// re-draw — which is why a busy WiFi network gets slower super-linearly. Deterministic
// (seeded), so the contention is reproducible. Tested.

export const CW_MIN = 7; // initial contention window (slots), 802.11-ish
export const CW_MAX = 255; // cap

/** Mulberry32 — a tiny deterministic PRNG (so the contention is reproducible). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Station { id: number; cw: number; backoff: number; sent: number; collisions: number }

interface Snap { backoffs: number[]; cws: number[] } // each station's state AFTER this slot
export type SlotEvent =
  | ({ kind: 'idle' } & Snap)
  | ({ kind: 'transmit'; station: number; acked: true } & Snap)
  | ({ kind: 'collision'; stations: number[] } & Snap);

export interface CsmaResult { stations: Station[]; timeline: SlotEvent[] }

/** Simulate `slots` of CSMA/CA over `n` stations that always have a frame to send. */
export function simulateCsma(n: number, slots: number, seed = 1): CsmaResult {
  const rand = rng(seed);
  const draw = (cw: number) => Math.floor(rand() * (cw + 1)); // backoff ∈ [0, CW]
  const st: Station[] = Array.from({ length: n }, (_, id) => ({ id, cw: CW_MIN, backoff: draw(CW_MIN), sent: 0, collisions: 0 }));
  const timeline: SlotEvent[] = [];

  const snap = (): { backoffs: number[]; cws: number[] } => ({ backoffs: st.map((x) => x.backoff), cws: st.map((x) => x.cw) });
  for (let s = 0; s < slots; s++) {
    const ready = st.filter((x) => x.backoff === 0);
    if (ready.length === 0) {
      // an idle slot: everyone decrements their backoff by one
      for (const x of st) x.backoff -= 1;
      timeline.push({ kind: 'idle', ...snap() });
      continue;
    }
    if (ready.length === 1) {
      // a clean transmission, ACKed; that station resets CW and draws a fresh backoff
      const w = ready[0];
      w.sent += 1; w.cw = CW_MIN; w.backoff = draw(CW_MIN);
      timeline.push({ kind: 'transmit', station: w.id, acked: true, ...snap() });
    } else {
      // collision: all the zero-backoff stations grow CW (BEB) and re-draw
      for (const w of ready) { w.collisions += 1; w.cw = Math.min(w.cw * 2 + 1, CW_MAX); w.backoff = draw(w.cw); }
      timeline.push({ kind: 'collision', stations: ready.map((x) => x.id), ...snap() });
    }
  }
  return { stations: st, timeline };
}

/** Standalone illustration of the race: whoever has the lowest backoff counter reaches zero
 *  first and seizes the channel (a tie at the bottom is what causes a collision). NOTE: the
 *  simulation above transmits at backoff===0 specifically — a slot whose minimum is >0 is idle
 *  (everyone decrements, nobody sends); this helper just ranks who's closest to firing. */
export function lowestBackoff(backoffs: number[]): number[] {
  const min = Math.min(...backoffs);
  return backoffs.map((b, i) => (b === min ? i : -1)).filter((i) => i >= 0);
}

/** Per-station share of successful transmissions (fairness check). */
export function shares(res: CsmaResult): number[] {
  const total = res.stations.reduce((a, x) => a + x.sent, 0) || 1;
  return res.stations.map((x) => x.sent / total);
}
