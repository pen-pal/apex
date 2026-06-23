// Traceroute — how a tool maps the routers between you and a destination using
// nothing but the TTL field. Every router decrements TTL by 1; when it hits 0 the
// router DROPS the packet and sends back an ICMP "Time Exceeded", revealing its own
// address. So you send probes with TTL = 1, 2, 3, …: each elicits a reply from the
// router one hop further out, until a probe finally reaches the destination, which
// replies differently (Echo Reply / Port Unreachable). A silent router shows "*".
// Pure, deterministic model. Tested.

export interface Hop {
  address: string; // router/destination IP (or hostname-ish label)
  rttMs: number; // measured round-trip time to this hop
  responds: boolean; // some routers/firewalls don't send Time Exceeded → "* * *"
}

export interface Path {
  source: string;
  dest: string;
  hops: Hop[]; // ordered routers between source and dest; the LAST hop is the destination
}

export type ProbeKind = 'time-exceeded' | 'destination' | 'timeout';

export interface ProbeResult {
  ttl: number;
  hopIndex: number; // which hop the probe reached (0-based; = ttl-1 when the path is long enough)
  kind: ProbeKind;
  address: string | null; // null when it timed out (no reply)
  rttMs: number | null;
  reachedDest: boolean;
}

/**
 * Send one probe with the given TTL down the path. The router at index ttl-1 is the
 * one whose TTL reaches 0. If that hop IS the destination, it replies as the target;
 * if it doesn't respond, it's a timeout ("*"); otherwise it's an ICMP Time Exceeded.
 */
export function probe(path: Path, ttl: number): ProbeResult {
  const hopIndex = ttl - 1;
  const lastIndex = path.hops.length - 1;
  if (hopIndex > lastIndex) {
    // TTL is larger than the path — the destination already answered earlier; treat as done.
    const dest = path.hops[lastIndex];
    return { ttl, hopIndex: lastIndex, kind: 'destination', address: dest.address, rttMs: dest.rttMs, reachedDest: true };
  }
  const hop = path.hops[hopIndex];
  if (!hop.responds) return { ttl, hopIndex, kind: 'timeout', address: null, rttMs: null, reachedDest: hopIndex === lastIndex };
  const reachedDest = hopIndex === lastIndex;
  return {
    ttl, hopIndex,
    kind: reachedDest ? 'destination' : 'time-exceeded',
    address: hop.address,
    rttMs: hop.rttMs,
    reachedDest,
  };
}

/** Run a full traceroute (TTL 1..maxTtl) and stop once the destination replies. */
export function traceroute(path: Path, maxTtl = 30): ProbeResult[] {
  const out: ProbeResult[] = [];
  for (let ttl = 1; ttl <= maxTtl; ttl++) {
    const r = probe(path, ttl);
    out.push(r);
    if (r.reachedDest) break;
  }
  return out;
}
