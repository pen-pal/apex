import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { sctp } from '../src/protocols/sctp';

// A hand-verified SCTP packet (RFC 9260 §3.1) carrying an INIT chunk — the first
// packet of the SCTP 4-way association setup. Only the fixed 12-byte common
// header is asserted here; the INIT chunk that follows lands in node.payload.
//
// COMMON HEADER (12 bytes):
//   Source port       0x0b80 = 2944
//   Destination port  0x0b59 = 2905  (M3UA / SIGTRAN)
//   Verification Tag  0x00000000      (MUST be 0 in a packet with an INIT chunk)
//   Checksum          0x748a9a0c      (real CRC32c over the whole packet; see below)
//
// INIT CHUNK (RFC 9260 §3.3.1, 20 bytes — the fixed part, no optional params):
//   Chunk Type   0x01            = INIT
//   Chunk Flags  0x00
//   Chunk Length 0x0014          = 20
//   Initiate Tag 0x12345678      (non-zero per the RFC)
//   a_rwnd       0x0000ffff      = 65535 advertised receive window
//   #Outbound    0x000a          = 10 streams
//   #Inbound     0x0005          = 5 streams
//   Initial TSN  0xabcdef01
//
// The Checksum is the CRC32c (Castagnoli) over the entire packet with the
// Checksum field zeroed; the 32-bit result is written to the field, appearing on
// the wire little-endian as the bytes 0x74 0x8a 0x9a 0x0c. Read as a big-endian
// 32-bit hex value (how the engine displays it) that is 0x748A9A0C. This value
// was computed off these exact bytes, not invented to match the dissector.
const commonHeader = [
  0x0b, 0x80, // src port 2944
  0x0b, 0x59, // dst port 2905
  0x00, 0x00, 0x00, 0x00, // verification tag (0 for INIT)
  0x74, 0x8a, 0x9a, 0x0c, // CRC32c checksum
];
const initChunk = [
  0x01, 0x00, 0x00, 0x14, // type=INIT(1), flags=0, length=20
  0x12, 0x34, 0x56, 0x78, // initiate tag
  0x00, 0x00, 0xff, 0xff, // a_rwnd = 65535
  0x00, 0x0a, // outbound streams = 10
  0x00, 0x05, // inbound streams = 5
  0xab, 0xcd, 0xef, 0x01, // initial TSN
];

describe('SCTP common header (RFC 9260)', () => {
  const reg = new ProtocolRegistry();
  reg.register(sctp);

  it('parses the fixed 12-byte common header', () => {
    const node = dissect([...commonHeader, ...initChunk], 'sctp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(12);
    expect(h.get('srcPort')).toBe(2944);
    expect(h.get('dstPort')).toBe(2905);
    // A packet carrying an INIT chunk MUST have a zero Verification Tag.
    expect(h.get('verificationTag')).toBe(0);
  });

  it('shows the Verification Tag and Checksum as hex', () => {
    const node = dissect([...commonHeader, ...initChunk], 'sctp', reg);
    const vtag = node.header.fields.find((f) => f.field.name === 'verificationTag')!;
    const cksum = node.header.fields.find((f) => f.field.name === 'checksum')!;
    expect(vtag.display).toBe('0x00000000');
    // The real CRC32c bytes 0x74 0x8a 0x9a 0x0c read big-endian.
    expect(cksum.display).toBe('0x748A9A0C');
  });

  it('leaves the INIT chunk as the payload and stops dissecting (no child)', () => {
    const node = dissect([...commonHeader, ...initChunk], 'sctp', reg);
    expect(node.payload).toEqual(initChunk);
    // First payload byte is the INIT chunk type (1).
    expect(node.payload[0]).toBe(0x01);
    expect(sctp.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
  });
});
