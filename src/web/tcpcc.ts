// TCP congestion control (Reno) — the cwnd/ssthresh state machine that decides
// how fast a sender may push, per RTT round. Slow start grows the window
// exponentially (×2 each RTT) until it reaches ssthresh; then congestion
// avoidance grows it linearly (+1 MSS per RTT). A loss halves ssthresh: a triple-
// duplicate-ACK (fast retransmit) drops cwnd to the new ssthresh and continues in
// avoidance; a timeout collapses cwnd to 1 and restarts slow start. This is the
// classic AIMD sawtooth (RFC 5681). Pure integer-ish math, tested.

export type Phase = 'slow-start' | 'congestion-avoidance';
export type LossKind = 'none' | 'triple-dup-ack' | 'timeout';

export interface CcRound {
  rtt: number; // round index (0-based)
  cwnd: number; // congestion window AT THE START of this round (in MSS)
  ssthresh: number;
  phase: Phase;
  event: LossKind; // a loss detected DURING this round (applied to the next)
}

export interface CcConfig {
  rounds: number;
  initialSsthresh: number;
  initialCwnd?: number;
  /** RTT round index → loss kind injected at that round. */
  losses?: Record<number, LossKind>;
}

/**
 * Simulate `rounds` RTTs of TCP Reno. Returns the per-round trace. A loss at
 * round r is observed at r and changes the window entering round r+1.
 */
export function simulateReno(cfg: CcConfig): CcRound[] {
  const losses = cfg.losses ?? {};
  let cwnd = cfg.initialCwnd ?? 1;
  let ssthresh = cfg.initialSsthresh;
  const trace: CcRound[] = [];

  for (let r = 0; r < cfg.rounds; r++) {
    const phase: Phase = cwnd < ssthresh ? 'slow-start' : 'congestion-avoidance';
    const event = losses[r] ?? 'none';
    trace.push({ rtt: r, cwnd, ssthresh, phase, event });

    // Apply the round's outcome to produce next round's window.
    if (event === 'timeout') {
      ssthresh = Math.max(1, Math.floor(cwnd / 2));
      cwnd = 1; // collapse to 1 MSS, restart slow start
    } else if (event === 'triple-dup-ack') {
      ssthresh = Math.max(1, Math.floor(cwnd / 2));
      cwnd = ssthresh; // fast recovery: drop to ssthresh, stay in avoidance
    } else if (phase === 'slow-start') {
      cwnd = Math.min(cwnd * 2, ssthresh); // exponential growth, capped at ssthresh
    } else {
      cwnd = cwnd + 1; // additive increase: +1 MSS per RTT
    }
  }
  return trace;
}

/** Peak cwnd reached across a trace (handy for scaling a chart). */
export function peakCwnd(trace: CcRound[]): number {
  return trace.reduce((m, r) => Math.max(m, r.cwnd, r.ssthresh), 1);
}
