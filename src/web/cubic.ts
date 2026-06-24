// TCP CUBIC (RFC 8312) — the congestion controller most of the internet's servers use by
// default (Linux since 2006). Where Reno grows the window by +1 every round-trip (a slow
// linear climb that wastes capacity on fast, high-latency links), CUBIC grows it along a
// CUBIC curve of the time since the last loss: fast as it climbs back toward the window it
// had before the loss (W_max), cautious and flat right around W_max (probing gently), then
// fast again above it to discover new capacity. Crucially the curve is independent of RTT,
// so flows on long and short paths grow comparably. Pure model, tested against the formula.

export const C = 0.4;    // CUBIC scaling constant
export const BETA = 0.7; // multiplicative decrease (Reno uses 0.5)

/** K = cube root of (W_max · (1−β) / C): how long until the curve returns to W_max. */
export const cubicK = (wmax: number): number => Math.cbrt((wmax * (1 - BETA)) / C);

/** The CUBIC window t round-trips after the last loss: W(t) = C·(t−K)³ + W_max. */
export function cubicWindow(wmax: number, t: number): number {
  const k = cubicK(wmax);
  return C * (t - k) ** 3 + wmax;
}

export type Phase = 'slow-start' | 'cubic';
export interface Round { round: number; cwnd: number; wmax: number; phase: Phase; loss: boolean }

/** Simulate `rounds` RTTs: slow start (×2) until the first loss, then CUBIC growth. A loss
 *  at a listed round sets W_max to the current window and restarts the CUBIC epoch. */
export function simulateCubic(rounds: number, lossRounds: number[], initialCwnd = 1): Round[] {
  const out: Round[] = [];
  let cwnd = initialCwnd, wmax = 0, epochStart = 0;
  let phase: Phase = 'slow-start';

  for (let r = 0; r < rounds; r++) {
    const loss = lossRounds.includes(r);
    if (loss) {
      wmax = cwnd;           // remember where congestion hit
      epochStart = r;        // restart the CUBIC epoch (t = 0 here → window = β·W_max)
      phase = 'cubic';
      cwnd = cubicWindow(wmax, 0); // == BETA * wmax
    } else if (phase === 'slow-start') {
      cwnd = cwnd * 2;       // exponential growth until the first loss
    } else {
      cwnd = cubicWindow(wmax, r - epochStart);
    }
    out.push({ round: r, cwnd, wmax, phase, loss });
  }
  return out;
}
