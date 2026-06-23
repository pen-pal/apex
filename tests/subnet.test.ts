import { describe, it, expect } from 'vitest';
import { parseIp, formatIp, maskOf, subnet, splitInto } from '../src/web/subnet';

describe('ip parse/format', () => {
  it('round-trips dotted quads', () => {
    expect(parseIp('192.168.1.1')).toBe(0xc0a80101);
    expect(formatIp(0xc0a80101)).toBe('192.168.1.1');
    expect(parseIp('255.255.255.255')).toBe(0xffffffff);
    expect(parseIp('0.0.0.0')).toBe(0);
  });
  it('rejects malformed input', () => {
    expect(parseIp('256.0.0.1')).toBeNull();
    expect(parseIp('1.2.3')).toBeNull();
    expect(parseIp('a.b.c.d')).toBeNull();
  });
});

describe('maskOf', () => {
  it('builds the right netmask', () => {
    expect(formatIp(maskOf(24))).toBe('255.255.255.0');
    expect(formatIp(maskOf(26))).toBe('255.255.255.192');
    expect(formatIp(maskOf(0))).toBe('0.0.0.0');
    expect(formatIp(maskOf(32))).toBe('255.255.255.255');
  });
});

describe('subnet (known examples)', () => {
  it('computes a /24', () => {
    const s = subnet('192.168.1.10/24');
    expect(s).toMatchObject({
      network: '192.168.1.0', broadcast: '192.168.1.255', mask: '255.255.255.0',
      wildcard: '0.0.0.255', firstHost: '192.168.1.1', lastHost: '192.168.1.254',
      totalAddresses: 256, usableHosts: 254,
    });
  });
  it('computes a /26 (host in the 3rd subnet)', () => {
    const s = subnet('10.0.0.130/26');
    expect(s.network).toBe('10.0.0.128');
    expect(s.broadcast).toBe('10.0.0.191');
    expect(s.firstHost).toBe('10.0.0.129');
    expect(s.lastHost).toBe('10.0.0.190');
    expect(s.usableHosts).toBe(62);
  });
  it('handles /31 (point-to-point, RFC 3021) and /32 (host)', () => {
    const p2p = subnet('10.0.0.0/31');
    expect(p2p.usableHosts).toBe(2); // both addresses usable, no broadcast
    expect(p2p.firstHost).toBe('10.0.0.0');
    expect(p2p.lastHost).toBe('10.0.0.1');
    const host = subnet('8.8.8.8/32');
    expect(host.usableHosts).toBe(1);
    expect(host.network).toBe('8.8.8.8');
    expect(host.broadcast).toBe('8.8.8.8');
  });
  it('flags bad input', () => {
    expect(subnet('192.168.1.0/33').ok).toBe(false);
    expect(subnet('nonsense').ok).toBe(false);
  });
});

describe('splitInto (VLSM)', () => {
  it('splits a /24 into four /26s', () => {
    const blocks = splitInto('192.168.1.0/24', 26)!;
    expect(blocks).toHaveLength(4);
    expect(blocks.map((b) => b.network)).toEqual(['192.168.1.0', '192.168.1.64', '192.168.1.128', '192.168.1.192']);
    expect(blocks[0].broadcast).toBe('192.168.1.63');
    expect(blocks[3].broadcast).toBe('192.168.1.255');
    expect(blocks[0].usableHosts).toBe(62);
  });
  it('refuses an equal-or-smaller prefix', () => {
    expect(splitInto('10.0.0.0/24', 24)).toBeNull();
    expect(splitInto('10.0.0.0/24', 23)).toBeNull();
  });
});
