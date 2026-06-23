import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ldp } from '../src/protocols/ldp';
import { ethernet } from '../src/protocols/ethernet';
import { ipv4 } from '../src/protocols/ipv4';
import { udp } from '../src/protocols/udp';
import { tcp } from '../src/protocols/tcp';

// A hand-verified LDP Hello PDU, anchored to RFC 5036 §3.5.2 (PDU header) and
// §3.4 (message common structure). Field widths and the "what the length counts"
// semantics come straight from the RFC, not from this dissector's output.
//
// LDP PDU header (RFC 5036 §3.5.2):
//   00 01            Version = 1
//   00 1e            PDU Length = 30  (= 6-byte LDP Id + 24-byte message;
//                    "total length ... excluding the Version and PDU Length fields")
//   01 01 01 01      LSR Id = 1.1.1.1  (first 4 octets of the LDP Identifier)
//   00 00            Label Space Id = 0  (platform-wide)
//
// First message — Hello (RFC 5036 §3.4 + §3.5.3):
//   01 00            U-bit = 0, Message Type = 0x0100 (Hello)
//   00 14            Message Length = 20 (= 4-byte Message ID + 16 bytes of TLVs)
//   00 00 00 01      Message ID = 1
//   04 00 00 04 00 0f 00 00          Common Hello Parameters TLV (type 0x0400, len 4, holdtime 15)
//   04 01 00 04 01 01 01 01          IPv4 Transport Address TLV (type 0x0401, len 4, 1.1.1.1)
const hello = [
  0x00, 0x01, 0x00, 0x1e, // Version=1, PDU Length=30
  0x01, 0x01, 0x01, 0x01, // LSR Id = 1.1.1.1
  0x00, 0x00, // Label Space Id = 0
  0x01, 0x00, 0x00, 0x14, // U=0, Type=0x0100 (Hello), Message Length=20
  0x00, 0x00, 0x00, 0x01, // Message ID = 1
  0x04, 0x00, 0x00, 0x04, 0x00, 0x0f, 0x00, 0x00, // Common Hello Parameters TLV
  0x04, 0x01, 0x00, 0x04, 0x01, 0x01, 0x01, 0x01, // IPv4 Transport Address TLV
];
// The parameter TLVs that fall through as the LDP payload (everything after the
// 18-byte fixed part: U/Type + Message Length + Message ID).
const helloTlvs = hello.slice(18);

// A hand-verified LDP Initialization PDU, the first message on a new TCP/646
// session (RFC 5036 §3.5.3). U=0, Type=0x0200 (Initialization), Message ID=2,
// carrying a Common Session Parameters TLV (type 0x0500, len 14).
const init = [
  0x00, 0x01, 0x00, 0x20, // Version=1, PDU Length=32
  0x01, 0x01, 0x01, 0x01, // LSR Id = 1.1.1.1
  0x00, 0x00, // Label Space Id = 0
  0x02, 0x00, 0x00, 0x16, // U=0, Type=0x0200 (Initialization), Message Length=22
  0x00, 0x00, 0x00, 0x02, // Message ID = 2
  0x05, 0x00, 0x00, 0x0e, // Common Session Parameters TLV (type 0x0500, len 14)
  0x00, 0x01, 0x00, 0xb4, 0x00, 0x00, 0x00, 0x00,
  0x02, 0x02, 0x02, 0x02, 0x00, 0x00, // Receiver LDP Id = 2.2.2.2:0
];

describe('LDP PDU dissection (RFC 5036 §3.5.2 + §3.4)', () => {
  const reg = new ProtocolRegistry();
  reg.register(ldp);

  it('parses the PDU header: version, PDU length semantics, LSR Id, label space', () => {
    const node = dissect(hello, 'ldp', reg);
    const h = node.header;
    // Version is always 1 for RFC 5036.
    expect(h.get('version')).toBe(1);
    // PDU Length counts everything after the PDU Length field: 6-byte LDP Id + 24-byte message.
    expect(h.get('pduLength')).toBe(30);
    expect(hello.length - 4).toBe(30); // wire length minus Version+PDU Length = PDU Length
    // LSR Id rendered as a dotted quad.
    expect(h.fields.find((f) => f.field.name === 'lsrId')!.display).toBe('1.1.1.1');
    // Platform-wide label space.
    expect(h.get('labelSpaceId')).toBe(0);
  });

  it('parses the first message: U-bit, message type enum, length, and id', () => {
    const node = dissect(hello, 'ldp', reg);
    const h = node.header;
    // U-bit clear (notify originator if unknown).
    expect(h.get('uBit')).toBe(0);
    // Message Type 0x0100 = Hello.
    expect(h.get('messageType')).toBe(0x0100);
    expect(h.fields.find((f) => f.field.name === 'messageType')!.display).toBe('256 (Hello)');
    // Message Length = Message ID(4) + parameter TLVs(16) = 20.
    expect(h.get('messageLength')).toBe(20);
    expect(h.get('messageId')).toBe(1);
  });

  it('bounds the PDU by PDU Length and leaves parameter TLVs as payload', () => {
    const node = dissect(hello, 'ldp', reg);
    // Fixed dissectable part is 18 bytes; the parameter TLVs fall through as payload.
    expect(node.header.byteLength).toBe(18);
    expect(node.payload).toEqual(helloTlvs);
    // LDP is the application leaf — no child protocol.
    expect(node.child).toBeNull();
  });

  it('does not let trailing stream bytes leak past PDU Length', () => {
    // Append bytes that would be the next PDU in the same stream.
    const trailing = [0x00, 0x01, 0x00, 0x16];
    const node = dissect([...hello, ...trailing], 'ldp', reg);
    // Payload bounded to exactly this PDU's TLVs; trailing bytes excluded.
    expect(node.payload).toEqual(helloTlvs);
  });

  it('reads the U-bit set when the high bit of the message word is 1', () => {
    // Flip the U-bit: first message word becomes 0x8100 (U=1, type still 0x0100).
    const withU = [...hello];
    withU[10] = 0x81;
    const node = dissect(withU, 'ldp', reg);
    expect(node.header.get('uBit')).toBe(1);
    expect(node.header.get('messageType')).toBe(0x0100);
  });

  it('decodes an Initialization message (the first message on a TCP/646 session)', () => {
    const node = dissect(init, 'ldp', reg);
    const h = node.header;
    expect(h.get('version')).toBe(1);
    expect(h.get('pduLength')).toBe(32);
    expect(h.get('messageType')).toBe(0x0200);
    expect(h.fields.find((f) => f.field.name === 'messageType')!.display).toBe('512 (Initialization)');
    expect(h.get('messageLength')).toBe(22);
    expect(h.get('messageId')).toBe(2);
  });

  it('field bit widths sum to exactly the 18-octet fixed part', () => {
    const totalBits = ldp.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(18 * 8);
  });
});

// A real-shaped full frame: Ethernet -> IPv4 -> UDP/646 -> LDP Hello, with REAL
// IPv4 and UDP checksums computed over these bytes. LDP Hellos are multicast to
// 224.0.0.2 (the "all routers" group) with TTL 1 (RFC 5036 §3.5.2 / §2.4.1).
// This verifies the dispatch chain ends at LDP with no byte misattributed.
const ethIpUdpLdpHello = [
  // Ethernet II: dst 01:00:5e:00:00:02 (IPv4 multicast 224.0.0.2), src 00:11:22:33:44:55, type IPv4
  0x01, 0x00, 0x5e, 0x00, 0x00, 0x02, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x08, 0x00,
  // IPv4: ihl5, total length 62, ttl 1, proto 17 (UDP), checksum 0xd7ab, 1.1.1.1 -> 224.0.0.2
  0x45, 0x00, 0x00, 0x3e, 0x00, 0x00, 0x00, 0x00, 0x01, 0x11, 0xd7, 0xab,
  0x01, 0x01, 0x01, 0x01, 0xe0, 0x00, 0x00, 0x02,
  // UDP: src 646, dst 646, length 42, checksum 0x0b3a
  0x02, 0x86, 0x02, 0x86, 0x00, 0x2a, 0x0b, 0x3a,
  // LDP Hello PDU (same 34 bytes as `hello` above)
  ...hello,
];

describe('LDP over the full stack', () => {
  const reg = new ProtocolRegistry();
  for (const spec of [ethernet, ipv4, udp, tcp, ldp]) reg.register(spec);

  it('dissects ethernet -> ipv4 -> udp(646) -> ldp with nothing misattributed', () => {
    const eth = dissect(ethIpUdpLdpHello, 'ethernet', reg);
    const ip = eth.child!;
    const u = ip.child!;
    const l = u.child!;
    expect(eth.header.spec.id).toBe('ethernet');
    expect(ip.header.spec.id).toBe('ipv4');
    expect(u.header.spec.id).toBe('udp');
    // UDP destination port 646 dispatches to LDP.
    expect(u.header.get('dstPort')).toBe(646);
    expect(l.header.spec.id).toBe('ldp');
    // The LDP layer parses the Hello correctly through the full chain.
    expect(l.header.get('version')).toBe(1);
    expect(l.header.get('messageType')).toBe(0x0100);
    expect(l.header.fields.find((f) => f.field.name === 'lsrId')!.display).toBe('1.1.1.1');
    // PDU bounded: payload is exactly the Hello's parameter TLVs, no Ethernet padding/FCS leak.
    expect(l.payload).toEqual(helloTlvs);
    expect(l.child).toBeNull();
  });

  it('dispatches TCP/646 to LDP for the session channel', () => {
    expect(tcp.next!(dissect(
      // Minimal TCP header with dst port 646; just to exercise the dispatch map.
      [0x30, 0x39, 0x02, 0x86, 0, 0, 0, 0, 0, 0, 0, 0, 0x50, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
      'tcp', reg,
    ).header, reg)).toBe('ldp');
  });
});
