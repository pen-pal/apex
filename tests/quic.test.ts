import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { quic } from '../src/protocols/quic';

// REAL CAPTURE: the protected Client Initial packet from RFC 9001, Appendix A.2
// ("The resulting protected packet is: c000000001088394c8f03e5157080000...").
// We dissect only the long-header prefix this spec models.
//
//   byte 0  : 0xC0 = 1100 0000
//             Header Form = 1, Fixed Bit = 1, Long Packet Type = 00 (Initial),
//             low 4 bits = 0000 (header-protected on the wire, RFC 9001 §5.4)
//   bytes 1-4: 00 00 00 01            -> Version 0x00000001 (QUIC v1, RFC 9000)
//   byte 5   : 0x08                   -> Destination Connection ID Length = 8 (falls through)
//   bytes 6-13: 83 94 c8 f0 3e 51 57 08 -> Destination Connection ID (falls through)
//   byte 14  : 0x00                   -> Source Connection ID Length = 0 (falls through)
//   bytes 15+: 00 ...                 -> length-prefixed + AEAD-encrypted payload (falls through)
const quicInitial = [
  0xc0, 0x00, 0x00, 0x00, 0x01, 0x08, 0x83, 0x94,
  0xc8, 0xf0, 0x3e, 0x51, 0x57, 0x08, 0x00, 0x00,
  0x44, 0x9e, 0x7b, 0x9a, 0xec, 0x34, 0xd1, 0xb1,
];

describe('QUIC long-header prefix dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(quic); // register ONLY our own spec

  const node = dissect(quicInitial, 'quic', reg);
  const h = node.header;

  it('parses the first-byte bit fields per RFC 9000 §17.2', () => {
    expect(h.get('headerForm')).toBe(1); // long header
    expect(h.get('fixedBit')).toBe(1); // valid QUIC
    expect(h.get('longPacketType')).toBe(0); // Initial
    // low 4 bits of 0xC0 are 0000 here (header-protected ciphertext in general)
    expect(h.get('typeSpecificBits')).toBe(0x0);
  });

  it('decodes the Long Packet Type enum as Initial', () => {
    const f = h.fields.find((p) => p.field.name === 'longPacketType')!;
    expect(f.display).toBe('0 (Initial)');
  });

  it('reads the 32-bit Version as QUIC v1 (0x00000001)', () => {
    expect(h.get('version')).toBe(0x00000001);
    const f = h.fields.find((p) => p.field.name === 'version')!;
    expect(f.display).toBe('0x00000001');
    expect(f.meaning).toContain('QUIC v1');
  });

  it('stops after Version: 5-byte modeled prefix, rest falls through as payload', () => {
    expect(h.byteLength).toBe(5);
    // everything after the 5-byte prefix (CID lengths/CIDs/encrypted body) is payload
    expect(node.payload.length).toBe(quicInitial.length - 5);
    // first payload byte is the Destination Connection ID Length (0x08)
    expect(node.payload[0]).toBe(0x08);
    expect(node.trailer.length).toBe(0);
  });

  it('dispatches by long packet type to the (not-yet-implemented) child id', () => {
    // child id is returned for the engine; it is not registered, so no child node
    expect(quic.next!(h, reg)).toBe('quic-initial');
    expect(node.child).toBeNull();
  });
});
