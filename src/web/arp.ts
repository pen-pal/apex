// ARP (RFC 826) — the glue between Layer 3 and Layer 2. To send an IP packet to a
// host on the same LAN, you need that host's MAC address. ARP finds it: check your
// ARP cache; on a miss, BROADCAST "who has 192.168.1.5? tell me", the owner UNICASTS
// "192.168.1.5 is at aa:bb:cc:..." and you cache the answer. A gratuitous ARP is an
// unsolicited announcement of your own IP→MAC, used to refresh everyone's cache when
// an IP moves (failover). Pure, deterministic model. Tested. (The Attacks section
// shows the ABUSE of this trust; here is the legitimate mechanism.)

export interface Host { ip: string; mac: string; name: string }
export interface CacheEntry { mac: string; age: number }
export type Cache = Record<string, CacheEntry>; // ip → entry

export type Step =
  | { kind: 'cache-hit'; ip: string; mac: string }
  | { kind: 'broadcast'; ip: string; from: string }
  | { kind: 'reply'; ip: string; mac: string; from: string }
  | { kind: 'learned'; ip: string; mac: string }
  | { kind: 'unresolved'; ip: string };

export interface ResolveResult {
  mac: string | null; // the resolved MAC, or null if nobody owns the IP
  broadcast: boolean; // did we have to ARP (cache miss)?
  steps: Step[]; // the sequence for the UI
  cache: Cache; // the requester's cache AFTER resolving
}

/**
 * Resolve `targetIp` from `requester`'s point of view, given the requester's cache
 * and who is on the LAN. Mutates a COPY of the cache and returns it.
 */
export function resolve(requester: Host, targetIp: string, cache: Cache, lan: Host[], now: number): ResolveResult {
  const next: Cache = { ...cache };
  const steps: Step[] = [];

  const cached = next[targetIp];
  if (cached) {
    steps.push({ kind: 'cache-hit', ip: targetIp, mac: cached.mac });
    return { mac: cached.mac, broadcast: false, steps, cache: next };
  }

  // cache miss → broadcast a who-has request
  steps.push({ kind: 'broadcast', ip: targetIp, from: requester.ip });
  const owner = lan.find((h) => h.ip === targetIp && h.ip !== requester.ip);
  if (!owner) {
    steps.push({ kind: 'unresolved', ip: targetIp });
    return { mac: null, broadcast: true, steps, cache: next };
  }
  // the owner unicasts an is-at reply; requester learns it
  steps.push({ kind: 'reply', ip: targetIp, mac: owner.mac, from: owner.ip });
  next[targetIp] = { mac: owner.mac, age: now };
  steps.push({ kind: 'learned', ip: targetIp, mac: owner.mac });
  return { mac: owner.mac, broadcast: true, steps, cache: next };
}

/**
 * A gratuitous ARP from `announcer`: every other host that ALREADY had an entry for
 * the announcer's IP updates it (and a configurable `populateAll` would add it to
 * everyone, the aggressive variant). Returns each host's updated cache.
 */
export function gratuitous(announcer: Host, caches: Record<string, Cache>, now: number): Record<string, Cache> {
  const out: Record<string, Cache> = {};
  for (const [hostIp, cache] of Object.entries(caches)) {
    if (hostIp === announcer.ip) { out[hostIp] = { ...cache }; continue; }
    const updated: Cache = { ...cache };
    if (updated[announcer.ip]) updated[announcer.ip] = { mac: announcer.mac, age: now }; // refresh existing
    out[hostIp] = updated;
  }
  return out;
}
