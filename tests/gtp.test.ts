import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { gtp } from '../src/protocols/gtp';

// A hand-verified GTP-U G-PDU, the kind an S-GW sends to an eNodeB on S1-U
// (UDP dst port 2152). Byte values cross-checked against 3GPP TS 29.281 §5.1
// (header format) and §6.1 (message types).
//
// Mandatory 8-byte header, big-endian:
//   byte 0  = 0x30  -> Version=1 (001), PT=1 (GTP), R=0, E=0, S=0, PN=0   (001 1 0 000)
//   byte 1  = 0xFF  -> Message Type 255 = G-PDU
//   bytes 2-3 = 0x0054 = 84   Length: octets after the mandatory header
//   bytes 4-7 = 0x12345678    TEID (the per-bearer tunnel id)
// Then the tunnelled subscriber packet: a 20-byte inner IPv4 header (version 4,
// IHL 5, total length 0x0054 = 84) plus 64 bytes of inner transport+data so the
// inner IP total length matches the GTP-U Length (a real G-PDU has Length equal
// to the full inner IP packet size when no optional fields are present).
const gtpHeader = [
  0x30, 0xff, 0x00, 0x54, 0x12, 0x34, 0x56, 0x78,
];
// Inner IPv4 packet, 84 bytes total (0x0054). First 20 bytes are the IP header.
const innerIp = [
  0x45, 0x00, 0x00, 0x54, 0x00, 0x00, 0x40, 0x00,
  0x40, 0x01, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x01,
  0x0a, 0x00, 0x00, 0x02,
  ...new Array(64).fill(0xaa),
];

describe('GTP-U dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(gtp);

  it('parses the mandatory 8-byte header', () => {
    const node = dissect([...gtpHeader, ...innerIp], 'gtp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(8);
    expect(h.get('version')).toBe(1);
    expect(h.get('protocolType')).toBe(1);
    expect(h.get('reserved')).toBe(0);
    expect(h.get('flags')).toBe(0); // E=S=PN=0
    expect(h.get('messageType')).toBe(255);
    expect(h.get('length')).toBe(84);
  });

  it('decodes message type 255 as G-PDU', () => {
    const node = dissect([...gtpHeader, ...innerIp], 'gtp', reg);
    const mt = node.header.fields.find((f) => f.field.name === 'messageType')!;
    expect(mt.meaning).toContain('G-PDU');
  });

  it('shows TEID as a 32-bit hex tunnel identifier', () => {
    const node = dissect([...gtpHeader, ...innerIp], 'gtp', reg);
    const teid = node.header.fields.find((f) => f.field.name === 'teid')!;
    expect(teid.display).toBe('0x12345678');
  });

  it('bounds the PDU at 8 + Length octets (no trailing leak)', () => {
    // Append 16 trailing bytes (e.g. Ethernet padding) that must NOT leak in.
    const node = dissect([...gtpHeader, ...innerIp, ...new Array(16).fill(0)], 'gtp', reg);
    // Length = 84, so payload (the tunnelled packet) is exactly 84 bytes.
    expect(node.payload.length).toBe(84);
    expect(node.trailer.length).toBe(16);
  });

  it('leaves the tunnelled inner IP packet as an opaque payload (no child here)', () => {
    const node = dissect([...gtpHeader, ...innerIp], 'gtp', reg);
    // The inner IP packet's offset is variable (optional fields), so this layer
    // stops and the inner packet falls through as node.payload (top-of-file note).
    expect(node.child).toBeNull();
    expect(node.payload.length).toBe(84);
    // The payload really is the inner IPv4 packet (first byte 0x45 = v4, IHL 5).
    expect(node.payload[0]).toBe(0x45);
  });

  it('reads the E/S/PN flags when an optional block would follow', () => {
    // First byte 0x37 -> Version=1, PT=1, R=0, E=1, S=1, PN=1 (001 1 0 111).
    const withFlags = [0x37, 0xff, 0x00, 0x04, 0x12, 0x34, 0x56, 0x78];
    const node = dissect([...withFlags, ...new Array(4).fill(0)], 'gtp', reg);
    expect(node.header.get('flags')).toBe(0b111); // E=S=PN=1
    const flags = node.header.fields.find((f) => f.field.name === 'flags')!;
    expect(flags.display).toContain('E');
    expect(flags.display).toContain('S');
    expect(flags.display).toContain('PN');
  });
});
