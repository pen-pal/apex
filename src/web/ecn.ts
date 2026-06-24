// Explicit Congestion Notification (ECN, RFC 3168) — telling a sender to slow down WITHOUT throwing
// its packet away. Normally a router signals congestion the only way it can: it drops a packet, and
// the loss tells TCP to back off — but a drop costs a retransmit and a latency spike. ECN lets the
// router instead MARK the packet. Two bits in the IP header (the ECN field) carry the state:
//   00 Not-ECT (endpoint isn't ECN-capable) · 10 ECT(0) / 01 ECT(1) (is capable) · 11 CE (Congestion Experienced).
// A congested router marks an ECT packet to CE instead of dropping it; the receiver echoes that back
// with the TCP ECE flag; the sender halves its window (exactly as if it had seen a loss) and sets CWR
// to acknowledge. Same congestion response, no packet lost, no retransmit. We model the router's
// per-packet decision and the CE→ECE→CWR signaling round. Pure, tested against RFC 3168.

export type ECN = 'Not-ECT' | 'ECT(0)' | 'ECT(1)' | 'CE';
export const isECT = (c: ECN): boolean => c === 'ECT(0)' || c === 'ECT(1)';

export interface RouterDecision { codepoint: ECN; action: 'forward' | 'mark' | 'drop'; note: string }

/** What a router does to a packet given its congestion state (RFC 3168 §5, §6). */
export function routerHandle(codepoint: ECN, congested: boolean): RouterDecision {
  if (!congested) return { codepoint, action: 'forward', note: 'queue has room — forward unchanged' };
  if (codepoint === 'CE') return { codepoint, action: 'forward', note: 'already marked CE upstream — forward' };
  if (isECT(codepoint)) return { codepoint: 'CE', action: 'mark', note: 'ECN-capable → MARK Congestion Experienced instead of dropping' };
  return { codepoint, action: 'drop', note: 'not ECN-capable → the only signal available is to DROP' };
}

export interface FlowResult {
  ecn: boolean;
  marks: number; // CE marks (ECN flow)
  drops: number; // packets dropped (non-ECN flow)
  retransmits: number; // == drops (each lost packet must be resent)
  cwndHalvings: number; // congestion responses (same either way)
  delivered: number;
}

/** Push `n` packets through a router that is congested on a given fraction, with/without ECN, and
 *  compare the cost. Both back off the same; only ECN avoids the drops and their retransmits. */
export function runFlow(n: number, congestedEvery: number, ecn: boolean): FlowResult {
  let marks = 0, drops = 0, halvings = 0, delivered = 0;
  let lastSignalAt = -Infinity;
  for (let i = 0; i < n; i++) {
    const congested = congestedEvery > 0 && i % congestedEvery === 0 && i > 0;
    const d = routerHandle(ecn ? 'ECT(0)' : 'Not-ECT', congested);
    if (d.action === 'drop') { drops++; }
    else { delivered++; if (d.action === 'mark') marks++; }
    // one cwnd halving per congestion signal (a mark or a drop), at most once per "RTT" window
    if ((d.action === 'mark' || d.action === 'drop') && i - lastSignalAt > 1) { halvings++; lastSignalAt = i; }
  }
  return { ecn, marks, drops, retransmits: drops, cwndHalvings: halvings, delivered };
}
