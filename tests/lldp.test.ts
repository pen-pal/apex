import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { lldp } from '../src/protocols/lldp';

// A real LLDP first TLV: the Chassis ID TLV (IEEE 802.1AB §8.5.2).
//
// TLV header (2 bytes), big-endian, type = top 7 bits, length = low 9 bits:
//   0x02 0x07  -> type=1 (Chassis ID), length=7 octets of value
//                 byte0 = 0000001 0  (type=0000001=1, length MSB=0)
//                 byte1 = 0000 0111  (length low 8 bits = 7)  -> length = 7
//
// Chassis ID value (7 bytes): subtype(1) + identifier(6)
//   0x04                      -> Chassis ID Subtype 4 = MAC address (EUI-48)
//   0x00:0x12:0x34:0x56:0x78:0x9a -> the chassis MAC address
//
// Then the next TLV in the LLDPDU begins — here a Port ID TLV header
//   0x04 0x07 ... -> type=2 (Port ID), length=7  (must NOT leak into this TLV)
const chassisIdTlv = [
  0x02, 0x07,                                     // TLV header: type=1, length=7
  0x04,                                           // Chassis ID Subtype = 4 (MAC address)
  0x00, 0x12, 0x34, 0x56, 0x78, 0x9a,             // chassis MAC = 00:12:34:56:78:9a
];
const nextPortIdTlv = [
  0x04, 0x07,                                     // next TLV header: type=2 (Port ID), length=7
  0x03, 0x00, 0x12, 0x34, 0x56, 0x78, 0x9b,       // Port ID subtype 3 (MAC) + MAC
];

describe('LLDP TLV dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(lldp);

  it('parses the 2-byte TLV header: 7-bit type and 9-bit length', () => {
    const node = dissect(chassisIdTlv, 'lldp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(2);
    expect(h.get('tlvType')).toBe(1); // Chassis ID
    expect(h.get('tlvLength')).toBe(7); // 1-byte subtype + 6-byte MAC
    expect(h.fields.find((f) => f.field.name === 'tlvType')!.meaning).toBe('Chassis ID');
  });

  it('bounds the payload to this TLV value (the next TLV does not leak in)', () => {
    const node = dissect([...chassisIdTlv, ...nextPortIdTlv], 'lldp', reg);
    // pduBytes = 2 + length(7) = 9; payload is exactly the 7-byte value.
    expect(node.payload.length).toBe(7);
    // value = subtype 4 (MAC) followed by the 6-byte chassis MAC.
    expect(node.payload).toEqual([0x04, 0x00, 0x12, 0x34, 0x56, 0x78, 0x9a]);
    // The trailing Port ID TLV is NOT part of this TLV.
    expect(node.trailer).toEqual(nextPortIdTlv);
  });

  it('stops dissecting after the TLV header (no child protocol)', () => {
    const node = dissect(chassisIdTlv, 'lldp', reg);
    expect(lldp.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
  });
});
