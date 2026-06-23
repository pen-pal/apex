import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dccp } from '../src/protocols/dccp';
import { dissect } from '../src/core/engine';
import { inetChecksum } from '../src/core/checksum';

// A hand-verified DCCP-Request packet, short-sequence-number form (X = 0),
// RFC 4340 §5.1. This is the first packet a DCCP client sends to open a
// connection. It is carried directly in IPv4 as IP Protocol 33.
//
// The packet is the 12-byte generic header plus a 4-byte Service Code subheader
// (the DCCP-Request fixed subheader, RFC 4340 §5.5) = 16 bytes, so Data Offset
// is 4 (4 x 32-bit words). The Checksum below is a REAL Internet checksum (RFC
// 1071) computed over the IPv4 pseudo-header (src 192.168.1.10, dst
// 192.168.1.20, proto 33, length 16) + the DCCP packet — see the assertion that
// recomputes it. Nothing here is fabricated.
//
// Byte layout (RFC 4340 §5.1, big-endian / network order):
//   0  C0 00          Source Port      = 49152
//   2  13 89          Dest Port        = 5001
//   4  04             Data Offset      = 4  (=> 16 bytes to app data)
//   5  00             CCVal=0 (hi nibble), CsCov=0 (lo nibble)
//   6  A4 D4          Checksum         = 0xA4D4 (real)
//   8  00             Res=0 (3 bits) | Type=0 DCCP-Request (4 bits) | X=0 (1 bit)
//   9  00 00 01       Sequence Number (low 24 bits) = 1
//  12  00 00 00 00    Service Code     = 0  (DCCP-Request subheader, falls through)
const srcIp = [192, 168, 1, 10];
const dstIp = [192, 168, 1, 20];
const genericHeader = [
  0xc0, 0x00, // src port
  0x13, 0x89, // dst port
  0x04,       // data offset = 4
  0x00,       // ccval=0, cscov=0
  0xa4, 0xd4, // checksum
  0x00,       // res(000) type(0000=Request) x(0)
  0x00, 0x00, 0x01, // seq low = 1
];
const serviceCode = [0x00, 0x00, 0x00, 0x00]; // DCCP-Request subheader
const packet = [...genericHeader, ...serviceCode];

describe('DCCP generic header (RFC 4340 §5.1, short form X=0)', () => {
  const reg = new ProtocolRegistry();
  reg.register(dccp);

  it('parses the 12-byte generic header and bounds it by Data Offset', () => {
    const node = dissect(packet, 'dccp', reg);
    // Data Offset = 4 words = 16 bytes. headerBytes() = Data Offset * 4 = 16, so
    // the header is bounded to the application-data boundary: the 12-byte generic
    // header plus the 4-byte Service Code subheader. There is no app data here, so
    // the payload is empty and dissection stops.
    expect(node.header.byteLength).toBe(16);
    expect(node.header.get('dataOffset')).toBe(4);
    expect(node.payload).toEqual([]);
    expect(node.child).toBeNull();
  });

  it('reads the ports (big-endian)', () => {
    const node = dissect(packet, 'dccp', reg);
    expect(node.header.get('srcPort')).toBe(49152);
    expect(node.header.get('dstPort')).toBe(5001);
  });

  it('identifies the packet Type as DCCP-Request (0)', () => {
    const node = dissect(packet, 'dccp', reg);
    expect(node.header.get('type')).toBe(0);
    const f = node.header.fields.find((x) => x.field.name === 'type')!;
    expect(f.display).toBe('0 (DCCP-Request)');
  });

  it('reads CCVal=0, CsCov=0, X=0, Reserved=0', () => {
    const node = dissect(packet, 'dccp', reg);
    expect(node.header.get('ccval')).toBe(0);
    expect(node.header.get('cscov')).toBe(0);
    expect(node.header.get('x')).toBe(0);
    expect(node.header.get('res')).toBe(0);
    const x = node.header.fields.find((f) => f.field.name === 'x')!;
    expect(x.meaning).toContain('short form');
  });

  it('reads the 24-bit sequence number', () => {
    const node = dissect(packet, 'dccp', reg);
    expect(node.header.get('sequenceNumberLow')).toBe(1);
  });

  it('carries a REAL Internet checksum (RFC 1071) over pseudo-header + packet', () => {
    const node = dissect(packet, 'dccp', reg);
    const fieldCk = node.header.get('checksum');
    // Recompute the checksum exactly as a DCCP receiver would (CsCov=0 => whole
    // packet), anchoring the test to RFC 1071/4340 rather than to our own output.
    const len = packet.length; // 16
    const pseudo = [...srcIp, ...dstIp, 0, 33, (len >> 8) & 255, len & 255];
    const zeroed = [...packet];
    zeroed[6] = 0;
    zeroed[7] = 0;
    const computed = inetChecksum([...pseudo, ...zeroed]);
    expect(fieldCk).toBe(0xa4d4);
    expect(computed).toBe(fieldCk);
  });

  it('bounds the header by Data Offset, exposing application data as payload', () => {
    // Same packet, but with 3 bytes of application data appended after the
    // 16-byte (Data Offset * 4) header region. Those bytes must fall through as
    // payload, not leak into the header.
    const appData = [0xde, 0xad, 0xbe];
    const node = dissect([...packet, ...appData], 'dccp', reg);
    expect(node.header.byteLength).toBe(16);
    expect(node.payload).toEqual(appData);
    expect(node.child).toBeNull();
  });

  it('field bit widths sum to exactly 12 bytes (short form)', () => {
    const totalBits = dccp.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(12 * 8);
  });
});
