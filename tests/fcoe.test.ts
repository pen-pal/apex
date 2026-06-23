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

// Start of the encapsulated FC frame header (FC-BB-5 retains the native FC frame).
// The first byte is R_CTL; here 0x06 with a destination/source FC ID follow. We do
// not dissect the FC frame (no FC spec registered) — we only assert it survives as
// the FCoE payload, intact and byte-for-byte.
const fcFrameStart = [
  0x06,             // R_CTL (routing control)
  0x01, 0x02, 0x03, // D_ID (destination FC address identifier)
  0x00,             // CS_CTL / Priority
  0x0a, 0x0b, 0x0c, // S_ID (source FC address identifier)
  0x08,             // TYPE (e.g. 0x08 = FCP / SCSI-FCP)
];

describe('FCoE dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(fcoe);

  it('parses the fixed 14-byte header (version, reserved padding, SOF)', () => {
    const node = dissect([...fcoeHeader, ...fcFrameStart], 'fcoe', reg);
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
    const node = dissect([...fcoeHeader, ...fcFrameStart], 'fcoe', reg);
    const reserved2 = node.header.fields.find((f) => f.field.name === 'reserved2')!;
    expect(reserved2.field.bits).toBe(96);
    expect(reserved2.bytes).toEqual([
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
  });

  it('carries the encapsulated FC frame intact as its payload', () => {
    const node = dissect([...fcoeHeader, ...fcFrameStart], 'fcoe', reg);
    // No FC dissector registered, so the FC frame lands in node.payload untouched.
    expect(fcoe.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
    expect(node.payload).toEqual(fcFrameStart);
    // The payload begins with the FC frame's R_CTL byte (FC-BB-5 retains the FC header).
    expect(node.payload[0]).toBe(0x06);
  });
});
