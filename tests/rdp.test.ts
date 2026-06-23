// RDP / TPKT (RFC 1006 §6 + MS-RDPBCGR §2.2.1.1) dissection test.
//
// Hand-verified capture: a Client X.224 Connection Request PDU as an RDP client
// sends it as the first packet to TCP port 3389. Structure (MS-RDPBCGR 2.2.1.1):
//
//   TPKT header (4 bytes):  03 00 00 2c
//     version  = 0x03 (TPKT, RFC 1006)
//     reserved = 0x00
//     length   = 0x002c = 44  (entire packet, including these 4 bytes)
//
//   x224Crq (7 bytes):      27 e0 00 00 00 00 00
//     LI       = 0x27 = 39  (octets after LI: covers the CR header, cookie, negReq)
//     code     = 0xe0       (X.224 Connection Request, CR, ITU-T X.224 §13.3)
//     dst-ref  = 0x0000
//     src-ref  = 0x0000
//     class    = 0x00       (Class 0)
//
//   cookie (25 bytes):      "Cookie: mstshash=eltons\r\n"
//   rdpNegReq (8 bytes):    01 00 08 00 00 00 00 00
//     type=0x01 (RDP_NEG_REQ), flags=0x00, length=0x0008 (LE), protocols=0 (LE)
//
//   Total = 4 + 7 + 25 + 8 = 44 = 0x2c, matching the TPKT length. Verified by
//   construction (see src/protocols/rdp.ts) and anchored to the RFC/MS spec, not
//   to the implementation's own output.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { rdp } from '../src/protocols/rdp';

const FRAME = [
  0x03, 0x00, 0x00, 0x2c,             // TPKT header
  0x27, 0xe0, 0x00, 0x00, 0x00, 0x00, 0x00, // x224 CR TPDU
  // "Cookie: mstshash=eltons\r\n"
  0x43, 0x6f, 0x6f, 0x6b, 0x69, 0x65, 0x3a, 0x20,
  0x6d, 0x73, 0x74, 0x73, 0x68, 0x61, 0x73, 0x68,
  0x3d, 0x65, 0x6c, 0x74, 0x6f, 0x6e, 0x73, 0x0d, 0x0a,
  // rdpNegReq
  0x01, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
];

describe('RDP (TPKT) dissection', () => {
  const registry = new ProtocolRegistry();
  registry.register(rdp);

  it('parses the 4-byte TPKT header (RFC 1006)', () => {
    const node = dissect(FRAME, 'rdp', registry);
    const h = node.header;
    expect(h.spec.id).toBe('rdp');
    expect(h.get('version')).toBe(3);     // TPKT version is always 3
    expect(h.get('reserved')).toBe(0);    // reserved, always 0
    expect(h.get('length')).toBe(44);     // 0x002c — whole packet incl. header
    expect(h.byteLength).toBe(4);         // fixed 4-byte TPKT header
  });

  it('bounds the PDU by the TPKT length and exposes the X.224/RDP payload', () => {
    const node = dissect(FRAME, 'rdp', registry);
    // pduBytes = length (44) == frame length, so no trailer leaks.
    expect(node.raw.length).toBe(44);
    expect(node.trailer.length).toBe(0);
    // Everything after the 4-byte TPKT header is the payload (X.224 + cookie + negReq).
    expect(node.payload.length).toBe(40);
    // First payload byte is the X.224 Length Indicator (0x27 = 39).
    expect(node.payload[0]).toBe(0x27);
    // Second is the X.224 CR TPDU code 0xE0.
    expect(node.payload[1]).toBe(0xe0);
    // Dissection stops at TPKT (X.224/RDP content is not dissected here).
    expect(node.child).toBeNull();
  });

  it('does not let a pipelined following PDU leak into the payload', () => {
    // Same 44-byte packet with extra bytes appended (a second PDU on the stream).
    const withTrailer = [...FRAME, 0x03, 0x00, 0x00, 0x07, 0x02, 0xf0, 0x80];
    const node = dissect(withTrailer, 'rdp', registry);
    // pduBytes (44) bounds where the payload ends; the rest becomes trailer.
    expect(node.header.byteLength).toBe(4);  // TPKT header
    expect(node.payload.length).toBe(40);    // payload unchanged (44 - 4)
    expect(node.trailer.length).toBe(7);     // the extra PDU is trailer, not payload
    expect(node.payload[node.payload.length - 1]).toBe(0x00); // last byte of negReq, not 0x03
  });

  it('the cookie bytes round-trip to the exact MS-RDPBCGR ASCII string', () => {
    const node = dissect(FRAME, 'rdp', registry);
    // payload[7..] (after the 7-byte X.224 CR TPDU) begins the cookie string.
    const cookie = node.payload.slice(7, 7 + 25);
    const text = String.fromCharCode(...cookie);
    expect(text).toBe('Cookie: mstshash=eltons\r\n');
  });
});
