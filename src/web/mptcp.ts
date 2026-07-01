// Multipath TCP (MPTCP) — one TCP connection that runs over SEVERAL network paths at once (your phone's Wi-Fi
// AND cellular together), transparently to the app. A normal socket is pinned to one pair of IP addresses; if
// the Wi-Fi drops as you walk out the door, the connection dies. MPTCP splits the connection into SUBFLOWS,
// one per path, and stripes the byte stream across them. The trick that makes it safe is a second layer of
// sequence numbers: each subflow has its own ordinary TCP sequence space (so middleboxes see normal TCP), but
// every byte also carries a connection-level Data Sequence Number (DSN) via the DSS option. Segments race
// across paths and arrive out of order, but the receiver reassembles by DSN into the exact original stream. If
// a path fails, its unacknowledged bytes are simply re-sent on a surviving path — no data lost, the connection
// lives. It's how an iPhone keeps Siri and Apple Music alive across a Wi-Fi→cellular handoff, and how you can
// aggregate two links' bandwidth. This models the scheduling, out-of-order arrival, DSN reassembly, and
// failover. Reference: RFC 8684 (MPTCP v1); Apple's MPTCP deployment.

export interface Path { id: number; name: string; capacity: number; latencyMs: number; up: boolean }
export interface Segment { dsn: number; chunk: string; pathId: number; arrival: number }

/** Stripe chunks across the UP paths, weighted by capacity; compute each segment's arrival time
 *  (path latency + queueing at that path's send rate) so faster/lower-latency paths deliver sooner. */
export function schedule(chunks: string[], paths: Path[]): Segment[] {
  const up = paths.filter((p) => p.up);
  if (up.length === 0) return [];
  const sent = new Map<number, number>(up.map((p) => [p.id, 0]));
  const segs: Segment[] = [];
  for (let dsn = 0; dsn < chunks.length; dsn++) {
    // pick the up-path that is least loaded relative to its capacity (proportional-fair scheduling)
    let best = up[0];
    for (const p of up) if (sent.get(p.id)! / p.capacity < sent.get(best.id)! / best.capacity) best = p;
    const k = sent.get(best.id)!; sent.set(best.id, k + 1);
    segs.push({ dsn, chunk: chunks[dsn], pathId: best.id, arrival: best.latencyMs + (k / best.capacity) * 1000 });
  }
  return segs;
}

/** Reassemble by connection-level Data Sequence Number — recovers the exact original stream, any arrival order. */
export function reassemble(segments: Segment[]): string {
  return [...segments].sort((a, b) => a.dsn - b.dsn).map((s) => s.chunk).join('');
}

/** Segments in the order they actually arrive on the wire (by time, ties broken by dsn). */
export function arrivalOrder(segments: Segment[]): Segment[] {
  return [...segments].sort((a, b) => a.arrival - b.arrival || a.dsn - b.dsn);
}

/** Aggregate throughput = sum of the up paths' capacities (the bandwidth win). */
export const throughput = (paths: Path[]): number => paths.filter((p) => p.up).reduce((s, p) => s + p.capacity, 0);
