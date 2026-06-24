import { describe, it, expect } from 'vitest';
import { checksumFor, headerAtTtl, walk } from '../src/web/ttlhop';
import { inetChecksum } from '../src/core/checksum';

const hx = (n: number) => n.toString(16).padStart(4, '0');

describe('IPv4 header checksum (RFC 1071) anchored to the canonical header', () => {
  it('the TTL-64 header checksums to 0xb861', () => {
    expect(hx(checksumFor(64))).toBe('b861'); // published worked-example value
  });

  it('decrementing TTL by one raises the checksum by 0x0100 (RFC 1624 incremental)', () => {
    // TTL is the high byte of a 16-bit word, so −1 to TTL = −0x0100 to the sum =
    // +0x0100 to the one's-complement checksum
    expect(checksumFor(63)).toBe((checksumFor(64) + 0x0100) & 0xffff);
    expect(hx(checksumFor(63))).toBe('b961');
  });

  it('a recomputed checksum makes the full header checksum to zero (valid)', () => {
    const h = headerAtTtl(63);
    h[10] = checksumFor(63) >> 8; h[11] = checksumFor(63) & 0xff; // insert the checksum
    expect(inetChecksum(h)).toBe(0); // a header with a correct checksum sums to 0
  });
});

describe('per-hop forwarding', () => {
  it('decrements TTL and recomputes the checksum at each router', () => {
    const j = walk(64, 3);
    expect(j.expired).toBe(false);
    expect(j.hops.map((h) => h.ttlOut)).toEqual([63, 62, 61]);
    expect(j.hops[0].checksum).toBe(checksumFor(63));
    expect(j.hops[2].checksum).toBe(checksumFor(61));
    expect(j.deliveredAtHop).toBe(3);
  });

  it('drops the packet and reports expiry when TTL hits 0', () => {
    const j = walk(2, 5); // TTL 2 → 1 → 0
    expect(j.expired).toBe(true);
    expect(j.hops).toHaveLength(2);          // dies at the second hop
    expect(j.hops[1].expired).toBe(true);
    expect(j.hops[1].ttlOut).toBe(0);
    expect(j.deliveredAtHop).toBe(null);
  });
});
