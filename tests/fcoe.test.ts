import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { fcoe } from '../src/protocols/fcoe';

// A hand-verified FCoE data frame (T11 FC-BB-5 §7.4) carrying the start of an
// encapsulated Fibre Channel frame. Byte values are anchored to the standard:
//  - the 14-byte FCoE header layout (version nibble, 13 reserved bytes, SOF byte)
//    from FC-BB-5 / the Wireshark FCoE dissector (packet-fcoe.c), and
//  - the SOFi3 code point 0x2E from RFC 3643 Table 2.
//
// FCoE header (14 bytes):
//   byte 0    0x00      -> Version = 0 (upper nibble), Reserved = 0 (lower nibble)
//   bytes1-12 0x00 x12  -> 96 reserved/padding bits, all zero
//   byte 13   0x2E      -> SOF = SOFi3 (class-3 initiate), the FC frame delimiter
const fcoeHeader = [
  0x00,                                                       // version | reserved
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,                         // reserved (6 of 12)
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,                         // reserved (12 of 12)
  0x2e,                                                       // SOF = SOFi3 (0x2E)
];

// A complete encapsulated FC frame (FC-BB-5 retains the native FC frame): the
// 24-byte FC header, a short FC payload, and the FC frame's own 4-byte CRC. We do
// not dissect the FC frame (no FC spec registered) — we only assert it survives as
// the FCoE payload, intact and byte-for-byte.
const fcFrame = [
  0x06, 0x01, 0x02, 0x03,             // R_CTL, D_ID
  0x00, 0x0a, 0x0b, 0x0c,             // CS_CTL/Priority, S_ID
  0x08, 0x00, 0x00, 0x00,             // TYPE (FCP), F_CTL
  0x01, 0x00, 0x00, 0x01,             // SEQ_ID, DF_CTL, SEQ_CNT
  0x12, 0x34, 0xff, 0xff,             // OX_ID, RX_ID
  0x00, 0x00, 0x00, 0x00,             // Parameter  (end of 24-byte FC header)
  0xde, 0xad, 0xbe, 0xef,             // FC payload (opaque, 4 bytes)
  0x11, 0x22, 0x33, 0x44,             // FC CRC (part of the FC frame)
];
// The FCoE trailer (FC-BB-5 §7.4): 1-byte EOF delimiter + 3 reserved bytes.
const fcoeTrailer = [0x41, 0x00, 0x00, 0x00]; // 0x41 = EOFn (Normal), per RFC 3643 Table 2

describe('FCoE dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(fcoe);

  it('parses the fixed 14-byte header (version, reserved padding, SOF)', () => {
    const node = dissect([...fcoeHeader, ...fcFrame, ...fcoeTrailer], 'fcoe', reg);
    const h = node.header;

    // FC-BB-5: the FCoE header is exactly 14 bytes.
    expect(h.byteLength).toBe(14);

    // Version MUST be 0 for FC-BB-5.
    expect(h.get('version')).toBe(0);
    // Low nibble of byte 0 is reserved = 0.
    expect(h.get('reserved1')).toBe(0);

    // SOF byte (byte 13) = 0x2E = SOFi3 (class-3 initiate), and it decodes by name.
    expect(h.get('sof')).toBe(0x2e);
    const sofField = h.fields.find((f) => f.field.name === 'sof')!;
    expect(sofField.display).toContain('SOFi3');
    // SOF is the last field in the header (the byte immediately before the FC frame).
    expect(h.fields[h.fields.length - 1].field.name).toBe('sof');
  });

  it('models the 12-byte reserved region as raw bytes (96 bits, all zero)', () => {
    const node = dissect([...fcoeHeader, ...fcFrame, ...fcoeTrailer], 'fcoe', reg);
    const reserved2 = node.header.fields.find((f) => f.field.name === 'reserved2')!;
    expect(reserved2.field.bits).toBe(96);
    expect(reserved2.bytes).toEqual([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
  });

  it('carries the encapsulated FC frame as payload and the EOF+reserved as trailer', () => {
    const node = dissect([...fcoeHeader, ...fcFrame, ...fcoeTrailer], 'fcoe', reg);
    // No FC dissector registered, so the FC frame lands in node.payload untouched.
    expect(fcoe.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
    // The 4-byte FCoE trailer (EOF + reserved) is carved off via trailerBytes, so the
    // payload is exactly the encapsulated FC frame and the trailer is the EOF+reserved.
    expect(node.payload).toEqual(fcFrame);
    expect(node.trailer).toEqual(fcoeTrailer);
    // The payload begins with the FC frame's R_CTL byte (FC-BB-5 retains the FC header).
    expect(node.payload[0]).toBe(0x06);
  });
});
