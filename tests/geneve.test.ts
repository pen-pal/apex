import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { geneve } from '../src/protocols/geneve';

// A hand-verified Geneve base header (RFC 8926 §3.1) with no options, followed by
// the start of the inner Ethernet frame it tunnels. Bytes anchored to the RFC,
// not to our own output.
//
// Geneve base header (8 bytes):
//   Byte 0: 0x00  -> Ver=00 (0), OptLen=000000 (0 words -> no options)
//   Byte 1: 0x00  -> O=0, C=0, Rsvd=0  (a plain data packet, no critical options)
//   Byte 2-3: 0x65 0x58 -> Protocol Type 0x6558 (Transparent Ethernet Bridging)
//   Byte 4-6: 0x01 0x02 0x03 -> VNI 0x010203 = 66051
//   Byte 7: 0x00  -> Reserved, zero
const geneveHeader = [0x00, 0x00, 0x65, 0x58, 0x01, 0x02, 0x03, 0x00];

// Inner Ethernet II frame (Protocol Type 0x6558 tunnels a full L2 frame):
//   dst MAC 00:11:22:33:44:55, src MAC 66:77:88:99:aa:bb, EtherType 0x0800 (IPv4)
const innerEthernet = [
  0x00, 0x11, 0x22, 0x33, 0x44, 0x55, // inner destination MAC
  0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, // inner source MAC
  0x08, 0x00, // EtherType = IPv4
];

describe('Geneve dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(geneve);

  it('parses the fixed 8-byte base header (no options)', () => {
    const node = dissect([...geneveHeader, ...innerEthernet], 'geneve', reg);
    const h = node.header;
    expect(h.byteLength).toBe(8);
    expect(h.get('version')).toBe(0);
    // OptLen = 0 -> no options -> 8-byte header.
    expect(h.get('optLen')).toBe(0);
    // Flags byte 0x00 -> neither O nor C set.
    expect(h.get('flags')).toBe(0x00);
    // Protocol Type 0x6558 -> inner Ethernet.
    expect(h.get('protocolType')).toBe(0x6558);
    expect(
      h.fields.find((f) => f.field.name === 'protocolType')!.meaning,
    ).toContain('Ethernet');
    // 24-bit VNI 0x010203 = 66051.
    expect(h.get('vni')).toBe(66051);
    // Reserved byte is zero.
    expect(h.get('reserved')).toBe(0);
  });

  it('sets the O and C flags from the second byte', () => {
    // O (0x80) + C (0x40) both set in the flags byte.
    const withFlags = [0x00, 0xc0, 0x65, 0x58, 0x01, 0x02, 0x03, 0x00];
    const node = dissect([...withFlags, ...innerEthernet], 'geneve', reg);
    const flags = node.header.fields.find((f) => f.field.name === 'flags')!;
    expect(node.header.get('flags')).toBe(0xc0);
    expect(flags.display).toContain('O');
    expect(flags.display).toContain('C');
  });

  it('accounts for variable options via Opt Len (4-byte units)', () => {
    // OptLen field = 0b000010 = 2 words = 8 bytes of options.
    // Byte 0: Ver(00) OptLen(000010) = 0x02.
    const header = [0x02, 0x00, 0x65, 0x58, 0x0a, 0x0b, 0x0c, 0x00];
    const options = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]; // 8 bytes of opaque options
    const node = dissect([...header, ...options, ...innerEthernet], 'geneve', reg);
    expect(node.header.get('optLen')).toBe(2);
    // Header length = 8 + 2*4 = 16 bytes; options must not leak into payload.
    expect(node.header.byteLength).toBe(16);
    expect(node.payload.length).toBe(innerEthernet.length);
    expect(node.payload.slice(0, 6)).toEqual([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
  });

  it('treats its payload as an inner Ethernet frame (the MAC-in-UDP point)', () => {
    const node = dissect([...geneveHeader, ...innerEthernet], 'geneve', reg);
    // No Ethernet spec registered here, so the inner frame lands in node.payload.
    expect(geneve.next!(node.header, reg)).toBe('ethernet');
    expect(node.payload.length).toBe(innerEthernet.length);
    expect(node.payload.slice(0, 6)).toEqual([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
  });

  it('dispatches by Protocol Type (0x0800 -> ipv4, 0x86dd -> ipv6)', () => {
    const ipv4Hdr = [0x00, 0x00, 0x08, 0x00, 0x01, 0x02, 0x03, 0x00];
    const ipv6Hdr = [0x00, 0x00, 0x86, 0xdd, 0x01, 0x02, 0x03, 0x00];
    expect(geneve.next!(dissect([...ipv4Hdr], 'geneve', reg).header, reg)).toBe('ipv4');
    expect(geneve.next!(dissect([...ipv6Hdr], 'geneve', reg).header, reg)).toBe('ipv6');
  });
});
