// TTL decrement and the IPv4 header-checksum recompute — the core job every router does
// to every packet. The Time To Live field (RFC 791) is decremented by one at each hop;
// because it lives in the header, the 16-bit header checksum (RFC 1071) must be
// recomputed every hop too. When TTL reaches 0 the packet is dropped and the router
// returns ICMP Time Exceeded (Type 11) — which is exactly what traceroute exploits. Real
// checksum from the engine core (inetChecksum), anchored to the canonical 0xb861 header.
import { inetChecksum } from '../core/checksum';

// Canonical IPv4 header (Wikipedia / RFC worked example): 192.168.0.1 → 192.168.0.199,
// UDP, total length 0x73, TTL 0x40 — checksum field zeroed here so we compute it.
const BASE: number[] = [
  0x45, 0x00, 0x00, 0x73, 0x00, 0x00, 0x40, 0x00,
  0x40, 0x11, 0x00, 0x00, 0xc0, 0xa8, 0x00, 0x01,
  0xc0, 0xa8, 0x00, 0xc7,
];
const TTL_OFFSET = 8;

/** The 20-byte header with a given TTL and the checksum field zeroed (ready to checksum). */
export function headerAtTtl(ttl: number): number[] {
  const h = BASE.slice();
  h[TTL_OFFSET] = ttl & 0xff;
  h[10] = 0; h[11] = 0;
  return h;
}

/** The correct IPv4 header checksum for a given TTL. */
export const checksumFor = (ttl: number): number => inetChecksum(headerAtTtl(ttl));

export interface Hop { hop: number; ttlIn: number; ttlOut: number; checksum: number; delivered: boolean; expired: boolean }
export interface Journey { hops: Hop[]; expired: boolean; deliveredAtHop: number | null }

/** Walk a packet across `routerCount` routers starting from `startTtl`. */
export function walk(startTtl: number, routerCount: number): Journey {
  const hops: Hop[] = [];
  let ttl = startTtl;
  for (let i = 0; i < routerCount; i++) {
    const ttlIn = ttl;
    ttl = ttl - 1; // each router decrements TTL by one
    const expired = ttl <= 0;
    const checksum = checksumFor(ttl < 0 ? 0 : ttl);
    const delivered = !expired && i === routerCount - 1;
    hops.push({ hop: i + 1, ttlIn, ttlOut: Math.max(0, ttl), checksum, delivered, expired });
    if (expired) return { hops, expired: true, deliveredAtHop: null };
  }
  return { hops, expired: false, deliveredAtHop: routerCount };
}
