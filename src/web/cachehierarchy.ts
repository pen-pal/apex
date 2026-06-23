// CDN / cache hierarchy — why the web is fast. A request for an object cascades
// through tiers: browser cache → CDN edge → origin. Each tier serves a HIT if it
// holds a copy that is still fresh (stored + TTL not yet expired); otherwise it's a
// MISS and the request continues to the next tier, which fetches, stores a copy
// (with its own TTL), and answers. When a cached copy has expired the tier
// REVALIDATES with the origin — a cheap conditional request that usually returns
// "304 Not Modified" and just refreshes the TTL. Latency grows with each tier you
// fall through. Pure, deterministic model (HTTP caching, RFC 9111). Tested.

export type Tier = 'browser' | 'edge' | 'origin';
export const TIERS: Tier[] = ['browser', 'edge', 'origin'];
export const LATENCY: Record<Tier, number> = { browser: 0, edge: 20, origin: 200 }; // ms to reach each tier
export const TTL: Record<Tier, number> = { browser: 30, edge: 120, origin: Infinity }; // freshness per tier (s)

interface Entry { storedAt: number } // when this tier cached the object

export interface RequestResult {
  object: string;
  servedBy: Tier; // which tier ultimately answered
  path: { tier: Tier; outcome: 'hit' | 'miss' | 'revalidated' }[]; // the cascade
  latencyMs: number;
  revalidated: boolean; // did any tier do a 304 refresh?
}

export class CacheHierarchy {
  // per tier: object name → cache entry
  private caches: Record<Tier, Map<string, Entry>> = { browser: new Map(), edge: new Map(), origin: new Map() };
  private hits = 0;
  private total = 0;

  constructor() {
    // the origin is authoritative — it always "has" everything (TTL ∞).
  }

  get hitRatio(): number { return this.total ? this.hits / this.total : 0; }
  get requests(): number { return this.total; }

  /** What each tier currently holds + seconds of TTL remaining (for display). */
  snapshot(now: number): Record<Tier, { object: string; ttlLeft: number }[]> {
    const out = { browser: [], edge: [], origin: [] } as Record<Tier, { object: string; ttlLeft: number }[]>;
    for (const tier of TIERS) {
      for (const [object, e] of this.caches[tier]) {
        const ttl = TTL[tier];
        out[tier].push({ object, ttlLeft: ttl === Infinity ? Infinity : Math.max(0, ttl - (now - e.storedAt)) });
      }
    }
    return out;
  }

  private fresh(tier: Tier, object: string, now: number): boolean {
    const e = this.caches[tier].get(object);
    if (!e) return false;
    const ttl = TTL[tier];
    return ttl === Infinity || now - e.storedAt < ttl;
  }

  /** Request `object` at time `now` (seconds). Walks the tiers, caching on the way back. */
  request(object: string, now: number): RequestResult {
    this.total++;
    const path: RequestResult['path'] = [];
    let hadStale = false; // did a cache hold an EXPIRED copy on the way down?

    for (let i = 0; i < TIERS.length; i++) {
      const tier = TIERS[i];
      if (this.fresh(tier, object, now)) {
        // a fresh copy serves the request; reaching the origin with stale upstream
        // copies is a 304 revalidation (cheap refresh) rather than a clean hit.
        const reval = tier === 'origin' && hadStale;
        path.push({ tier, outcome: reval ? 'revalidated' : 'hit' });
        if (tier !== 'origin') this.hits++; // served from a real cache → saved a trip
        this.storeUpTo(i, object, now); // refresh this tier and the ones above it
        return { object, servedBy: tier, path, latencyMs: LATENCY[tier], revalidated: reval };
      }
      if (this.caches[tier].has(object)) hadStale = true; // an expired copy lived here
      path.push({ tier, outcome: 'miss' });
    }

    // Fell through every tier → the origin had no copy at all (cold object): fetch + store.
    this.caches.origin.set(object, { storedAt: now });
    this.storeUpTo(TIERS.length - 1, object, now);
    return { object, servedBy: 'origin', path, latencyMs: LATENCY.origin, revalidated: false };
  }

  /** Cache the object in every tier from `topIndex` up to the browser (index 0). */
  private storeUpTo(topIndex: number, object: string, now: number): void {
    for (let j = 0; j <= topIndex; j++) this.caches[TIERS[j]].set(object, { storedAt: now });
  }
}
