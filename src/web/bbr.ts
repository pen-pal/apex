// TCP BBR (Cardwell et al., 2016) — congestion control that models the path instead of
// reacting to loss. BBR continuously estimates two things: the bottleneck bandwidth
// (BtlBw, the max delivery rate it has seen) and the round-trip propagation delay (RTprop,
// the min RTT it has seen). Their product is the Bandwidth-Delay Product, and BBR keeps
// just about one BDP of data in flight — enough to fill the pipe, but not so much that data
// piles up in the bottleneck's buffer. That's the whole point: loss-based controllers
// (Reno/CUBIC) keep pushing until the buffer overflows, which adds latency (bufferbloat)
// for everyone; BBR holds the queue near empty. Pure model, tested.

export interface Link { btlBwMbps: number; rtPropMs: number; bufferKB: number }

/** BDP in kilobytes = bandwidth × propagation delay. */
export function bdpKB(link: Link): number {
  return (link.btlBwMbps * 1e6 / 8) * (link.rtPropMs / 1000) / 1024;
}

export interface FlowState {
  inflightKB: number;
  queueKB: number;       // data sitting in the bottleneck buffer
  rttMs: number;         // experienced RTT = propagation + queueing
  throughputMbps: number;
}

/** BBR steady state: hold inflight ≈ 1 BDP, so the buffer stays essentially empty. */
export function bbrSteady(link: Link): FlowState {
  const bdp = bdpKB(link);
  const inflight = bdp; // BBR targets one BDP
  const queue = Math.max(0, inflight - bdp); // ≈ 0
  return { inflightKB: inflight, queueKB: queue, rttMs: link.rtPropMs + (queue * 1024 * 8) / (link.btlBwMbps * 1e6) * 1000, throughputMbps: link.btlBwMbps };
}

/** Loss-based steady state: grow until the buffer is full, so queue = buffer (bufferbloat). */
export function lossBasedSteady(link: Link): FlowState {
  const bdp = bdpKB(link);
  const inflight = bdp + link.bufferKB; // fills the pipe AND the buffer before loss
  const queue = link.bufferKB;
  const queueDelayMs = (queue * 1024 * 8) / (link.btlBwMbps * 1e6) * 1000;
  return { inflightKB: inflight, queueKB: queue, rttMs: link.rtPropMs + queueDelayMs, throughputMbps: link.btlBwMbps };
}

export interface StartupRound { round: number; estBwMbps: number; plateau: boolean }

/** BBR STARTUP: double the delivery-rate estimate each round until it stops growing —
 *  that plateau is BtlBw. (Three flat rounds → exit startup and drain the queue.) */
export function startup(link: Link, rounds = 10): StartupRound[] {
  const out: StartupRound[] = [];
  let est = 1; // Mbps, initial probe
  let flat = 0;
  for (let r = 0; r < rounds; r++) {
    const next = Math.min(est * 2, link.btlBwMbps); // can't deliver faster than the bottleneck
    const plateau = next === est;
    if (plateau) flat++; else flat = 0;
    out.push({ round: r, estBwMbps: next, plateau });
    est = next;
    if (flat >= 2) break; // BtlBw found
  }
  return out;
}
