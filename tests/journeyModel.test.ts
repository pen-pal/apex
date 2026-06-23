import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { registerCoreProtocols } from '../src/protocols';
import { buildJourney } from '../src/web/journeyModel';

function journey(message: string) {
  const registry = new ProtocolRegistry();
  registerCoreProtocols(registry);
  return buildJourney([...new TextEncoder().encode(message)], registry);
}

describe('buildJourney', () => {
  it('derives the layer nest from the child chain, outermost first', () => {
    const j = journey('Hi');
    expect(j.layers.map((l) => l.id)).toEqual(['ethernet', 'ipv4', 'tcp']);
    expect(j.layers.map((l) => l.headerBytes)).toEqual([14, 20, 20]);
    expect(j.payloadLength).toBe(2);
    expect(j.payloadAscii).toBe('Hi');
    expect(j.trailerLength).toBe(4); // FCS
  });

  it('builds a flat byte layout whose segments sum to the total frame', () => {
    const j = journey('Hello');
    const sum = j.segments.reduce((s, x) => s + x.length, 0);
    expect(sum).toBe(j.totalBytes);
    expect(j.segments.map((s) => s.id)).toEqual(['ethernet', 'ipv4', 'tcp', 'payload', 'fcs']);
    // 14 + 20 + 20 + 5 + 4
    expect(j.totalBytes).toBe(63);
  });

  it('recovers the exact message through the engine (round-trip is real)', () => {
    expect(journey('GET /').recovered).toBe('GET /');
  });

  it('shows the router re-wrap: TTL decremented, IP checksum + FCS + MACs recomputed', () => {
    const j = journey('Hi');
    const byField = new Map(j.routerChanges.map((c) => [`${c.layer}:${c.field}`, c]));

    const ttl = byField.get('IPv4:TTL');
    expect(ttl).toBeDefined();
    expect(ttl!.before).toBe('64');
    expect(ttl!.after).toBe('63');

    // The IPv4 header checksum must change because the TTL byte changed.
    expect(byField.has('IPv4:Header checksum')).toBe(true);
    // New link layer for the next hop.
    expect(byField.has('Ethernet II:Destination MAC')).toBe(true);
    expect(byField.has('Ethernet II:Source MAC')).toBe(true);
    // The Ethernet FCS is recomputed for the new frame.
    expect(byField.has('Frame:FCS / trailer')).toBe(true);

    // Things that must NOT change across the hop (end-to-end fields).
    expect(byField.has('IPv4:Source IP')).toBe(false);
    expect(byField.has('TCP:Sequence number')).toBe(false);
    expect(byField.has('TCP:Checksum')).toBe(false);
  });
});
