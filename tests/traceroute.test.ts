import { describe, it, expect } from 'vitest';
import { probe, traceroute, type Path } from '../src/web/traceroute';

const path: Path = {
  source: '192.168.1.5',
  dest: '93.184.216.34',
  hops: [
    { address: '192.168.1.1', rttMs: 1.2, responds: true }, // home router
    { address: '100.64.0.1', rttMs: 8.5, responds: true }, // ISP
    { address: '203.0.113.9', rttMs: 14.0, responds: false }, // a silent router → *
    { address: '198.51.100.1', rttMs: 22.3, responds: true }, // backbone
    { address: '93.184.216.34', rttMs: 24.1, responds: true }, // destination
  ],
};

describe('probe — TTL reaches the router at hop ttl-1', () => {
  it('TTL=1 elicits Time Exceeded from the first hop', () => {
    const r = probe(path, 1);
    expect(r.kind).toBe('time-exceeded');
    expect(r.address).toBe('192.168.1.1');
    expect(r.hopIndex).toBe(0);
    expect(r.reachedDest).toBe(false);
  });
  it('TTL=2 reveals the next router out', () => {
    expect(probe(path, 2).address).toBe('100.64.0.1');
  });
  it('a non-responding router gives a timeout ("*")', () => {
    const r = probe(path, 3);
    expect(r.kind).toBe('timeout');
    expect(r.address).toBeNull();
    expect(r.rttMs).toBeNull();
  });
  it('the final TTL reaches the destination (a different reply)', () => {
    const r = probe(path, 5);
    expect(r.kind).toBe('destination');
    expect(r.address).toBe('93.184.216.34');
    expect(r.reachedDest).toBe(true);
  });
});

describe('traceroute — full run stops at the destination', () => {
  it('produces one row per hop and ends when the dest replies', () => {
    const rows = traceroute(path);
    expect(rows).toHaveLength(5); // 5 TTLs, last reaches dest
    expect(rows.map((r) => r.kind)).toEqual(['time-exceeded', 'time-exceeded', 'timeout', 'time-exceeded', 'destination']);
    expect(rows.map((r) => r.address)).toEqual(['192.168.1.1', '100.64.0.1', null, '198.51.100.1', '93.184.216.34']);
    expect(rows[rows.length - 1].reachedDest).toBe(true);
  });
  it('RTTs are revealed for responding hops only', () => {
    const rows = traceroute(path);
    expect(rows[0].rttMs).toBe(1.2);
    expect(rows[2].rttMs).toBeNull(); // the silent hop
    expect(rows[4].rttMs).toBe(24.1);
  });
  it('a short maxTtl stops early without reaching the dest', () => {
    const rows = traceroute(path, 2);
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.reachedDest)).toBe(false);
  });
});
