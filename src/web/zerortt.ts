// 0-RTT resumption & the replay problem — how TLS 1.3 / QUIC send application data in the VERY FIRST packet
// (zero round trips to the first byte), and the sharp edge that comes with it. On a first visit the client
// does a normal handshake and the server hands it a RESUMPTION TICKET (a pre-shared key, PSK). On the next
// visit the client can encrypt request data with that PSK and attach it as EARLY DATA to its first flight —
// the server can act on it before completing the handshake. The catch: early data has NO server-contributed
// freshness yet, so a network attacker who captured it can REPLAY the same bytes and the server will process
// them again. That's fine for idempotent/safe requests (a GET) but catastrophic for a POST that charges a
// card or ships an order. So the rule is: only put replay-safe requests in 0-RTT. References: RFC 8446 §2.3 &
// §8 (TLS 1.3, anti-replay); RFC 9001 (QUIC).

export type Mode = 'full' | 'resume' | '0rtt';
export interface ConnResult { mode: Mode; rttToFirstByte: number; usesTicket: boolean; earlyData: boolean; replayable: boolean }

/** Establish a connection. 0-RTT and plain resumption both need a ticket from a prior visit; without one they
 *  fall back to a full handshake. Only 0-RTT carries early data (rtt 0) — and only 0-RTT early data is
 *  replayable. (RTT here is QUIC-style: a full handshake is 1 RTT to first byte, 0-RTT is 0.) */
export function connect(mode: Mode, hasTicket: boolean): ConnResult {
  if ((mode === '0rtt' || mode === 'resume') && !hasTicket) mode = 'full'; // no ticket → must do the full handshake
  if (mode === '0rtt') return { mode, rttToFirstByte: 0, usesTicket: true, earlyData: true, replayable: true };
  if (mode === 'resume') return { mode, rttToFirstByte: 1, usesTicket: true, earlyData: false, replayable: false };
  return { mode: 'full', rttToFirstByte: 1, usesTicket: false, earlyData: false, replayable: false };
}

/** Idempotent/safe HTTP methods — the only ones that belong in 0-RTT early data. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const safeForEarlyData = (method: string): boolean => SAFE_METHODS.has(method.toUpperCase());

export interface ReplayOutcome { deliveries: number; logicalEffects: number; harmful: boolean }

/** What happens if 0-RTT early data carrying `method` is replayed `deliveries` times. An idempotent request
 *  has the same effect no matter how many times it lands (1 logical effect); a non-idempotent one applies
 *  once per delivery — the double-charge / duplicate-order bug. */
export function replay(method: string, deliveries: number): ReplayOutcome {
  const safe = safeForEarlyData(method);
  const logicalEffects = safe ? Math.min(1, deliveries) : deliveries;
  return { deliveries, logicalEffects, harmful: !safe && deliveries > 1 };
}
