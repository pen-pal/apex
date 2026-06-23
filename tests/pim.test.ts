import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { inetChecksum } from '../src/core/checksum';
import { pim } from '../src/protocols/pim';

// A hand-verified PIMv2 Hello message (RFC 7761 §4.9 common header + §4.9.2
// Hello body), i.e. the bytes that follow IP (protocol 103), multicast to the
// ALL-PIM-ROUTERS group 224.0.0.13.
//
// PIM common header (4 bytes):
//   0x20        PIM Ver = 2 (high nibble), Type = 0 Hello (low nibble)
//   0x00        Reserved
//   0x79 0xF4   Checksum (RFC 1071 Internet checksum over the whole message)
// Hello body (two TLV options, RFC 7761 §4.9.2):
//   00 01 00 02 00 69   OptionType 1 Holdtime, len 2, value 105 seconds
//   00 14 00 04 a1 b2 c3 d4  OptionType 20 Generation ID, len 4, value
const pimMsg = [
  0x20, 0x00, 0x79, 0xf4,                         // 4-byte common header
  0x00, 0x01, 0x00, 0x02, 0x00, 0x69,             // Holdtime option (105s)
  0x00, 0x14, 0x00, 0x04, 0xa1, 0xb2, 0xc3, 0xd4, // Generation ID option
];

describe('PIM-SM v2 dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(pim);

  it('parses the fixed 4-byte common header (RFC 7761 §4.9)', () => {
    const node = dissect(pimMsg, 'pim', reg);
    const h = node.header;
    expect(h.byteLength).toBe(4);
    expect(h.get('version')).toBe(2);
    expect(h.get('type')).toBe(0); // Hello
    expect(h.get('reserved')).toBe(0);
    expect(h.fields.find((f) => f.field.name === 'type')!.meaning).toBe('Hello');
    expect(h.fields.find((f) => f.field.name === 'checksum')!.display).toBe('0x79F4');
  });

  it('leaves the Hello TLV options in the payload (PIM is top of stack)', () => {
    const node = dissect(pimMsg, 'pim', reg);
    expect(node.child).toBe(null);
    expect(pim.next!(node.header, reg)).toBe(null);
    // 4-byte header consumed; the 14 bytes of TLV options remain.
    expect(node.payload.length).toBe(14);
    // First option = Holdtime (type 1, len 2, value 105).
    expect(node.payload.slice(0, 6)).toEqual([0x00, 0x01, 0x00, 0x02, 0x00, 0x69]);
  });

  it('checksum is the RFC 1071 Internet checksum over the entire message', () => {
    // Recompute over the full message with the checksum field zeroed; the
    // result must equal the 0x79F4 carried on the wire. This anchors the
    // capture to the RFC, not to the spec's own output.
    const zeroed = pimMsg.slice();
    zeroed[2] = 0;
    zeroed[3] = 0;
    expect(inetChecksum(zeroed)).toBe(0x79f4);
  });
});
