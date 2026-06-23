import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { gre } from '../src/protocols/gre';

// A real RFC 2784 GRE header encapsulating an IPv4 packet (the common GRE-over-IP
// tunnel case, e.g. a Cisco "tunnel mode gre ip" link). This is the 4-byte
// mandatory header with no optional fields:
//
//   Byte 0-1: 0x0000
//     bit 0      C   = 0   (no checksum -> no optional words, header is 4 bytes)
//     bits 1-12  Reserved0 = 0
//     bits 13-15 Ver = 0   (RFC 2784 GRE)
//   Byte 2-3: 0x0800 = Protocol Type = EtherType IPv4
//
// The IPv4 packet that follows (here a minimal 20-byte IPv4 header, version 4 /
// IHL 5 = 0x45, total length 20) lands in node.payload — only the GRE layer is
// registered/asserted here.
const greHeader = [0x00, 0x00, 0x08, 0x00];
const innerIpv4 = [
  0x45, 0x00, 0x00, 0x14, // ver/ihl, dscp/ecn, total length = 20
  0x00, 0x00, 0x40, 0x00, // id, flags/frag
  0x40, 0x06, 0x00, 0x00, // ttl=64, proto=6 (TCP), checksum (zeroed here)
  0x0a, 0x00, 0x00, 0x01, // src 10.0.0.1
  0x0a, 0x00, 0x00, 0x02, // dst 10.0.0.2
];

describe('GRE dissection (RFC 2784)', () => {
  const reg = new ProtocolRegistry();
  reg.register(gre);

  it('parses the mandatory 4-byte header', () => {
    const node = dissect([...greHeader, ...innerIpv4], 'gre', reg);
    const h = node.header;
    expect(h.byteLength).toBe(4);
    expect(h.get('checksumPresent')).toBe(0);
    expect(h.get('reserved0')).toBe(0);
    expect(h.get('version')).toBe(0);
    expect(h.get('protocolType')).toBe(0x0800);
  });

  it('formats Protocol Type as the IPv4 EtherType', () => {
    const node = dissect([...greHeader, ...innerIpv4], 'gre', reg);
    const f = node.header.fields.find((x) => x.field.name === 'protocolType')!;
    expect(f.display).toBe('2048 (IPv4)');
  });

  it('dispatches to the ipv4 child by EtherType, with the inner packet as payload', () => {
    const node = dissect([...greHeader, ...innerIpv4], 'gre', reg);
    expect(gre.next!(node.header, reg)).toBe('ipv4');
    // The inner IPv4 packet falls through untouched (gre is the only registered spec).
    expect(node.payload).toEqual(innerIpv4);
    expect(node.payload[0]).toBe(0x45); // IPv4 version 4 / IHL 5
  });

  it('dispatches IPv6 and Transparent Ethernet Bridging payloads', () => {
    const v6 = dissect([0x00, 0x00, 0x86, 0xdd], 'gre', reg);
    expect(gre.next!(v6.header, reg)).toBe('ipv6');
    const teb = dissect([0x00, 0x00, 0x65, 0x58], 'gre', reg);
    expect(gre.next!(teb.header, reg)).toBe('ethernet');
  });
});
