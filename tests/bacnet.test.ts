import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { bacnet } from '../src/protocols/bacnet';
import { dissect } from '../src/core/engine';

// A hand-verified BACnet/IP "Who-Is" broadcast — the canonical BACnet device
// discovery message, sent as an Original-Broadcast-NPDU. This is the textbook
// 12-octet frame that appears in countless real captures on UDP/47808.
//
// Layout (big-endian):
//   BVLC header (ANSI/ASHRAE 135, Annex J.2.2), 4 octets:
//     0  81           Type     = 0x81 (BACnet/IP)
//     1  0B           Function = 0x0B (Original-Broadcast-NPDU)
//     2  00 0C        Length   = 0x000C = 12  (entire BVLL message, incl. header)
//   BACnet NPDU (clause 6), 6 octets — falls through as payload here:
//     4  01           Version = 1
//     5  20           Control = 0x20 (destination present)
//     6  FF FF        DNET = 0xFFFF (global broadcast)
//     8  00           DLEN = 0 (broadcast, no specific MAC)
//     9  FF           Hop Count = 255
//   BACnet APDU (clause 20.1.2) — Unconfirmed-Request Who-Is, 2 octets:
//    10  10           PDU Type 1 (Unconfirmed-Request)
//    11  08           Service Choice 8 (Who-Is)
//
// Length = 0x000C = 12 = 4 (BVLC) + 8 (NPDU+APDU). Assertions are anchored to
// Annex J.2.2 and to these real wire bytes, not to the implementation's output.
const bvlc = [0x81, 0x0b, 0x00, 0x0c];
const npduApdu = [0x01, 0x20, 0xff, 0xff, 0x00, 0xff, 0x10, 0x08];
const frame = [...bvlc, ...npduApdu];

describe('BACnet/IP BVLC header dissection (ASHRAE 135 Annex J.2.2)', () => {
  const reg = new ProtocolRegistry();
  reg.register(bacnet);

  it('parses the fixed 4-byte BVLC header and stops (no child)', () => {
    const node = dissect(frame, 'bacnet', reg);
    expect(node.header.byteLength).toBe(4);
    expect(node.child).toBeNull();
  });

  it('reads the fixed 0x81 BACnet/IP type byte', () => {
    const node = dissect(frame, 'bacnet', reg);
    expect(node.header.get('type')).toBe(0x81);
    const f = node.header.fields.find((x) => x.field.name === 'type')!;
    expect(f.meaning).toBe('0x81 (BACnet/IP)');
  });

  it('identifies the function as Original-Broadcast-NPDU (0x0B)', () => {
    const node = dissect(frame, 'bacnet', reg);
    expect(node.header.get('function')).toBe(0x0b);
    const f = node.header.fields.find((x) => x.field.name === 'function')!;
    expect(f.display).toBe('11 (Original-Broadcast-NPDU)');
  });

  it('reads the Length as the whole 12-byte BVLL message (big-endian)', () => {
    const node = dissect(frame, 'bacnet', reg);
    expect(node.header.get('length')).toBe(12);
    const f = node.header.fields.find((x) => x.field.name === 'length')!;
    expect(f.meaning).toBe('12 bytes (4-byte BVLC header + 8 bytes payload)');
  });

  it('bounds the payload to Length: the NPDU+APDU fall through, padding cannot leak', () => {
    // Append trailing bytes (e.g. Ethernet padding) the Length field must exclude.
    const padded = [...frame, 0xde, 0xad, 0xbe, 0xef];
    const node = dissect(padded, 'bacnet', reg);
    // payload = Length(12) - header(4) = exactly the 8 NPDU+APDU bytes.
    expect(node.payload).toEqual(npduApdu);
    // The trailing padding is excluded from the BVLL message.
    expect(node.payload).not.toContain(0xde);
  });

  it('field bit widths sum to exactly the 4-byte header', () => {
    const totalBits = bacnet.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(4 * 8);
  });
});
