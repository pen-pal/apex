import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ppp } from '../src/protocols/ppp';
import { ipv4 } from '../src/protocols/ipv4';

// A hand-verified PPP-encapsulated IPv4 packet, as it appears inside a PPPoE
// Session (RFC 2516) or after the HDLC Address/Control bytes have been stripped.
// The PPP encapsulation is just the 2-octet Protocol field, then the datagram.
//
//   PPP Protocol   0x0021          = IPv4 (RFC 1661 §2 — note it is ODD)
//
// followed by the start of a real, checksummed 20-byte IPv4 header carrying a
// 1-byte payload (Total length 21):
//   0x45            version 4, IHL 5 (20-byte header)
//   0x00            DSCP/ECN 0
//   0x0015          Total length = 21 (20 IP header + 1 byte data)
//   0x0000          Identification 0
//   0x0000          Flags 0, Fragment offset 0
//   0x40            TTL = 64
//   0x11            Protocol = 17 (UDP)
//   0xf6d4          Header checksum (real RFC 1071 sum over the 20-byte header)
//   0xc0000201      Source IP 192.0.2.1
//   0xc0000202      Destination IP 192.0.2.2
const pppHeader = [0x00, 0x21]; // PPP Protocol = 0x0021 (IPv4)
const ipv4Packet = [
  0x45, 0x00, 0x00, 0x15, // version/IHL, DSCP/ECN, total length 21
  0x00, 0x00, 0x00, 0x00, // identification, flags+offset
  0x40, 0x11, 0xf6, 0xd4, // TTL 64, protocol 17 (UDP), checksum
  0xc0, 0x00, 0x02, 0x01, // src 192.0.2.1
  0xc0, 0x00, 0x02, 0x02, // dst 192.0.2.2
  0xaa, // 1 byte of payload
];

describe('PPP dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(ppp);
  reg.register(ipv4);

  it('parses the 2-octet Protocol field', () => {
    const node = dissect([...pppHeader, ...ipv4Packet], 'ppp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(2);
    expect(h.get('protocol')).toBe(0x0021);
    // enum display is "<decimal value> (<name>)"; 0x0021 = 33.
    expect(h.fields.find((f) => f.field.name === 'protocol')!.display).toBe('33 (IPv4)');
  });

  it('the Protocol value is odd, per RFC 1661 §2', () => {
    const node = dissect([...pppHeader, ...ipv4Packet], 'ppp', reg);
    expect(node.header.get('protocol') & 1).toBe(1);
  });

  it('dispatches IPv4 (0x0021) to the ipv4 dissector', () => {
    const node = dissect([...pppHeader, ...ipv4Packet], 'ppp', reg);
    expect(ppp.next!(node.header, reg)).toBe('ipv4');
    expect(node.child).not.toBeNull();
    expect(node.child!.header.spec.id).toBe('ipv4');
    expect(node.child!.header.get('totalLength')).toBe(21);
    expect(node.child!.header.fields.find((f) => f.field.name === 'srcIp')!.display).toBe('192.0.2.1');
    expect(node.child!.header.fields.find((f) => f.field.name === 'dstIp')!.display).toBe('192.0.2.2');
  });

  it('exposes the encapsulated datagram as the PPP payload', () => {
    const node = dissect([...pppHeader, ...ipv4Packet], 'ppp', reg);
    expect(node.payload.length).toBe(ipv4Packet.length);
    expect(node.payload.slice(0, 2)).toEqual([0x45, 0x00]);
  });

  it('returns null for a control protocol so its body falls to payload', () => {
    // 0xC021 = LCP. Apex has no LCP option dissector, so dissection stops here.
    const lcp = dissect([0xc0, 0x21, 0x01, 0x01, 0x00, 0x04], 'ppp', reg);
    expect(lcp.header.get('protocol')).toBe(0xc021);
    // 0xC021 = 49185.
    expect(lcp.header.fields.find((f) => f.field.name === 'protocol')!.display).toBe(
      '49185 (LCP (Link Control Protocol))',
    );
    expect(ppp.next!(lcp.header, reg)).toBeNull();
    expect(lcp.child).toBeNull();
    expect(lcp.payload).toEqual([0x01, 0x01, 0x00, 0x04]);
  });
});
