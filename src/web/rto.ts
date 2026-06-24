// TCP's retransmission timeout (RFC 6298, the Jacobson/Karels algorithm). TCP can't
// use a fixed timeout — RTT varies wildly — so it tracks a smoothed RTT (SRTT) and an
// RTT variation (RTTVAR) and sets RTO = SRTT + 4·RTTVAR, then clamps to ≥ 1 s. Karn's
// algorithm adds two rules: never take an RTT sample from a RETRANSMITTED segment (you
// can't tell which copy the ACK answered), and on a timeout, double the RTO
// (exponential backoff) until a clean ACK arrives. Exact formulas, tested.

export const ALPHA = 1 / 8; // SRTT gain
export const BETA = 1 / 4; // RTTVAR gain
export const K = 4;
export const MIN_RTO = 1000; // RFC 6298: lower bound 1 second
export const MAX_RTO = 60000;

const clamp = (x: number) => Math.min(MAX_RTO, Math.max(MIN_RTO, x));

export interface RtoState { srtt: number; rttvar: number; rawRto: number; rto: number; samples: number }

/** First RTT measurement R: SRTT=R, RTTVAR=R/2. */
export function first(r: number): RtoState {
  const srtt = r, rttvar = r / 2, raw = srtt + K * rttvar;
  return { srtt, rttvar, rawRto: raw, rto: clamp(raw), samples: 1 };
}

/** Subsequent measurement: RTTVAR ← (1−β)RTTVAR + β|SRTT−R|; SRTT ← (1−α)SRTT + αR. */
export function update(s: RtoState, r: number): RtoState {
  const rttvar = (1 - BETA) * s.rttvar + BETA * Math.abs(s.srtt - r);
  const srtt = (1 - ALPHA) * s.srtt + ALPHA * r;
  const raw = srtt + K * rttvar;
  return { srtt, rttvar, rawRto: raw, rto: clamp(raw), samples: s.samples + 1 };
}

/** Karn: a timeout doubles the RTO and takes NO sample (the retransmit is ambiguous). */
export function backoff(s: RtoState): RtoState {
  return { ...s, rto: clamp(s.rto * 2), rawRto: s.rawRto };
}

/** Feed a measurement, honoring Karn: a retransmitted segment's RTT is ignored. */
export function measure(s: RtoState | null, r: number, retransmitted: boolean): RtoState {
  if (retransmitted) return s ? backoff(s) : first(r); // ambiguous → don't sample, back off
  return s ? update(s, r) : first(r);
}
