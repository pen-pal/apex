// Request coalescing (singleflight) — stopping a cache miss from turning into a stampede. When a hot
// cache key expires, every concurrent request misses at once and they ALL hit the backend for the same
// value: the "thundering herd" / cache stampede that can knock the database over precisely when traffic
// is highest. Singleflight fixes it: the first request for a key starts the computation, and every other
// request that arrives WHILE it's in flight waits for and shares that one result instead of starting its
// own. So N simultaneous misses become 1 backend call. Requests arriving after it completes just hit the
// now-warm cache. Reference: Go's golang.org/x/sync/singleflight; the cache-stampede literature.

export interface Req { key: string; arrival: number }
export type Outcome = 'compute' | 'shared' | 'hit';
export interface FlightResult { results: { req: Req; outcome: Outcome }[]; computations: number; shared: number; hits: number }

/** Process requests in arrival order. A key's first miss starts a computation lasting `computeMs`;
 *  requests for that key during the in-flight window either share it (singleflight) or each recompute
 *  (naive); once it completes the value is cached, so later requests are hits. */
export function simulate(reqs: Req[], computeMs: number, dedup: boolean): FlightResult {
  const sorted = [...reqs].sort((a, b) => a.arrival - b.arrival);
  const inflightUntil: Record<string, number> = {}; // key → end time of the active computation
  const warm: Record<string, boolean> = {};
  const results: { req: Req; outcome: Outcome }[] = [];
  let computations = 0, shared = 0, hits = 0;

  for (const req of sorted) {
    const flying = inflightUntil[req.key] !== undefined && req.arrival < inflightUntil[req.key];
    let outcome: Outcome;
    if (flying) {
      if (dedup) { outcome = 'shared'; shared++; }            // coalesced into the in-flight call
      else { outcome = 'compute'; computations++; }            // naive: every concurrent miss recomputes
    } else if (warm[req.key]) {
      outcome = 'hit'; hits++;                                 // cache already populated
    } else {
      outcome = 'compute'; computations++;                     // the first miss starts the computation
      inflightUntil[req.key] = req.arrival + computeMs;
      warm[req.key] = true;                                    // value is cached once the computation finishes
    }
    results.push({ req, outcome });
  }
  return { results, computations, shared, hits };
}
