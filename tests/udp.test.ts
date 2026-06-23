import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { udp } from '../src/protocols/udp';

// A real DNS-over-UDP datagram, captured client -> resolver (a standard A-record
// query for "example.com"). Only the 8-byte UDP header is asserted here; the DNS
// message that follows lands in node.payload.
//
// UDP header:
//   Source port      0xcb2b = 52011  (ephemeral)
//   Destination port 0x0035 = 53     (DNS)
//   Length           0x0025 = 37     (8-byte header + 29-byte DNS query)
//   Checksum         0x... (treated as opaque hex here)
//
// DNS query message (29 bytes): id=0x1234, flags=0x0100 (standard query, RD),
// QDCOUNT=1, QNAME = 7"example"3"com"0, QTYPE=A(1), QCLASS=IN(1).
const udpHeader = [0xcb, 0x2b, 0x00, 0x35, 0x00, 0x25, 0x8d, 0x42];
const dnsQuery = [
  0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 12-byte DNS header
  0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, // 7 "example"
  0x03, 0x63, 0x6f, 0x6d, 0x00, // 3 "com" + root
  0x00, 0x01, 0x00, 0x01, // QTYPE=A, QCLASS=IN
];

describe('UDP dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(udp);

  it('parses the fixed 8-byte header', () => {
    const node = dissect([...udpHeader, ...dnsQuery], 'udp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(8);
    expect(h.get('srcPort')).toBe(52011);
    expect(h.get('dstPort')).toBe(53);
    expect(h.get('length')).toBe(37);
    expect(h.fields.find((f) => f.field.name === 'checksum')!.display).toBe('0x8D42');
  });

  it('bounds the payload by the Length field (no trailing bytes leak in)', () => {
    // Length=37 -> payload is exactly 37 - 8 = 29 bytes, even with trailing padding.
    const node = dissect([...udpHeader, ...dnsQuery, ...new Array(10).fill(0xff)], 'udp', reg);
    expect(node.payload.length).toBe(29);
    expect(node.trailer.length).toBe(10);
    // The DNS message lands in the payload, starting with the DNS transaction id.
    expect(node.payload.slice(0, 2)).toEqual([0x12, 0x34]);
  });

  it('dispatches to the DNS child by destination port', () => {
    const node = dissect([...udpHeader, ...dnsQuery], 'udp', reg);
    expect(udp.next!(node.header, reg)).toBe('dns');
  });
});
