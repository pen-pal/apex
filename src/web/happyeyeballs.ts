// Happy Eyeballs (RFC 8305) — how a dual-stack client connects fast without getting stuck on
// a broken IPv6 path. The old behavior tried IPv6, and if it hung you waited a full TCP
// timeout (tens of seconds) before falling back to IPv4 — a terrible experience on networks
// with flaky IPv6. Happy Eyeballs instead RACES the two: it starts the IPv6 connection first
// (IPv6 is preferred), and if it hasn't completed within a short "Connection Attempt Delay"
// (~250 ms), it starts IPv4 in parallel and uses whichever connects first — preferring IPv6
// on a tie. A failing IPv6 path is bypassed in a fraction of a second instead of stalling.
// Pure timing model, tested.

export interface Endpoint { connectMs: number | null; failMs: number | null } // exactly one set, or both null = timeout
export interface Race {
  ipv4StartMs: number;     // when the IPv4 attempt is launched
  ipv6ConnectMs: number | null;
  ipv4ConnectMs: number | null; // absolute time (from t=0)
  winner: 'IPv6' | 'IPv4' | null;
  connectMs: number | null;
}

/** Race IPv6 (started at t=0) against IPv4 (started after the attempt delay, or sooner if
 *  IPv6 has already failed). Earliest successful connect wins; ties go to IPv6. */
export function race(ipv6: Endpoint, ipv4: Endpoint, attemptDelayMs = 250): Race {
  // launch IPv4 at the attempt delay — unless IPv6 errored out earlier, then launch right away
  const ipv4StartMs = ipv6.failMs !== null && ipv6.failMs < attemptDelayMs ? ipv6.failMs : attemptDelayMs;

  const ipv6ConnectMs = ipv6.connectMs;
  const ipv4ConnectMs = ipv4.connectMs !== null ? ipv4StartMs + ipv4.connectMs : null;

  let winner: Race['winner'] = null, connectMs: number | null = null;
  if (ipv6ConnectMs !== null && (ipv4ConnectMs === null || ipv6ConnectMs <= ipv4ConnectMs)) {
    winner = 'IPv6'; connectMs = ipv6ConnectMs; // IPv6 preferred (incl. ties)
  } else if (ipv4ConnectMs !== null) {
    winner = 'IPv4'; connectMs = ipv4ConnectMs;
  }
  return { ipv4StartMs, ipv6ConnectMs, ipv4ConnectMs, winner, connectMs };
}

export const ok = (connectMs: number): Endpoint => ({ connectMs, failMs: null });
export const refused = (failMs: number): Endpoint => ({ connectMs: null, failMs });
export const timeout = (): Endpoint => ({ connectMs: null, failMs: null });
