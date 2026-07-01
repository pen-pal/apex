// TIME_WAIT & ephemeral-port exhaustion — why the side that closes a TCP connection can't reuse its port for a
// while, and how that quietly caps how many connections per second a client can open. When you close a TCP
// connection, the side that sent the first FIN (the "active closer") doesn't free the connection immediately —
// it parks it in TIME_WAIT for 2×MSL (Linux: 60s). Two reasons: (1) a delayed duplicate segment from THIS
// connection must not be mistaken for data on a NEW connection that reuses the same 4-tuple; (2) if the final
// ACK is lost, the peer will resend its FIN and this side must still be around to re-ACK it. The cost: every
// connection an outbound client makes uses one EPHEMERAL port (a local port from a pool of ~28k), and that
// port stays pinned in TIME_WAIT for 60s after close. By Little's law, ports held ≈ rate × TIME_WAIT — so a
// client hammering short-lived connections (think a load generator, or a service with no connection pooling
// talking to one backend) runs OUT of ephemeral ports and new connects fail with EADDRNOTAVAIL, even though
// nothing is really "busy." This models that arithmetic. Reference: RFC 793 / 1122 (TIME_WAIT); the classic
// "TIME_WAIT and port exhaustion" ops write-ups.

export interface Params {
  connRate: number;    // new outbound connections per second (to a single destination)
  timeWaitSec: number; // how long each closed connection pins its ephemeral port (2×MSL)
  portPool: number;    // size of the ephemeral port range (e.g. 61000-32768 ≈ 28232)
}

export interface Result {
  portsHeld: number;      // ports pinned in TIME_WAIT at steady state (Little's law: rate × time)
  exhausted: boolean;     // demand exceeds the pool → new connects fail (EADDRNOTAVAIL)
  utilizationPct: number; // portsHeld / portPool
  maxRate: number;        // the highest sustainable connect rate for this pool + TIME_WAIT
}

/** Steady-state ephemeral-port pressure from a sustained connection rate. */
export function analyze(p: Params): Result {
  const portsHeld = p.connRate * p.timeWaitSec;      // Little's law: occupancy = arrival rate × hold time
  const maxRate = p.portPool / p.timeWaitSec;
  return {
    portsHeld,
    exhausted: portsHeld > p.portPool,
    utilizationPct: (portsHeld / p.portPool) * 100,
    maxRate,
  };
}

/** Max sustainable connects/sec before exhaustion, given the pool and TIME_WAIT. */
export const maxSustainableRate = (portPool: number, timeWaitSec: number): number => portPool / timeWaitSec;
