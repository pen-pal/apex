import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { mongodb } from '../src/protocols/mongodb';
import { dissect } from '../src/core/engine';

// A hand-verified MongoDB Wire Protocol message: the fixed 16-byte msgHeader
// (MongoDB Wire Protocol spec) for a modern OP_MSG (2013) request. MongoDB
// integers are LITTLE-ENDIAN on the wire; the spec marks each 32-bit field
// endian:'le' so the engine reads the true value. Assertions are anchored to the
// real wire bytes and to the published MongoDB wire-protocol structure, not to
// the implementation's own output.
//
// msgHeader (little-endian on the wire):
//   0  29 00 00 00              messageLength = 0x29 = 41  (16-byte header + 25-byte body)
//   4  D2 04 00 00              requestID     = 0x4D2 = 1234
//   8  00 00 00 00              responseTo    = 0          (this is an original request)
//  12  DD 07 00 00              opCode        = 0x7DD = 2013 = OP_MSG
const header = [
  0x29, 0x00, 0x00, 0x00,
  0xd2, 0x04, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0xdd, 0x07, 0x00, 0x00,
];

// A 25-byte OP_MSG body to prove the header is bounded to exactly 16 bytes and
// the body falls through as payload. It begins with the 4-byte flagBits word
// (0 = no flags), section kind 0x00 ("body"), then a minimal BSON document.
// 25 = 41 - 16 (messageLength - header), so pduBytes must bound it exactly.
const body = [
  0x00, 0x00, 0x00, 0x00, // OP_MSG flagBits = 0
  0x00,                   // section kind 0 (body)
  // a 20-byte BSON document: {ping: 1} style filler (exact contents not asserted;
  // BSON is length-prefixed and not dissected here).
  0x14, 0x00, 0x00, 0x00, 0x10, 0x70, 0x69, 0x6e, 0x67, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];
// Plus a trailing byte from a hypothetical NEXT pipelined message, to prove
// pduBytes stops the payload exactly at messageLength (41) and does not leak.
const trailing = [0xff];
const frame = [...header, ...body, ...trailing];

describe('MongoDB Wire Protocol msgHeader dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(mongodb);

  it('parses the fixed 16-byte header and stops (no child)', () => {
    const node = dissect(frame, 'mongodb', reg);
    expect(node.header.byteLength).toBe(16);
    expect(node.child).toBeNull();
  });

  it('bounds the payload to messageLength (no trailing leak)', () => {
    const node = dissect(frame, 'mongodb', reg);
    // messageLength = 41; header = 16; payload must be exactly the 25 body bytes.
    expect(node.payload).toEqual(body);
    expect(node.payload.length).toBe(25);
    // the 0xFF trailing byte is NOT part of this message's payload.
    expect(node.payload).not.toContain(0xff);
  });

  it('reads messageLength little-endian (=41, includes the header)', () => {
    const node = dissect(frame, 'mongodb', reg);
    // Wire bytes 29 00 00 00 read little-endian = 41.
    expect(node.header.get('messageLength')).toBe(41);
    const f = node.header.fields.find((x) => x.field.name === 'messageLength')!;
    expect(f.meaning).toContain('41 bytes total');
    expect(f.meaning).toContain('25 bytes body');
  });

  it('reads requestID little-endian (=1234)', () => {
    const node = dissect(frame, 'mongodb', reg);
    // Wire bytes D2 04 00 00 read little-endian = 0x000004D2 = 1234.
    expect(node.header.get('requestID')).toBe(1234);
  });

  it('reads responseTo = 0 (an original request, not a reply)', () => {
    const node = dissect(frame, 'mongodb', reg);
    expect(node.header.get('responseTo')).toBe(0);
    const f = node.header.fields.find((x) => x.field.name === 'responseTo')!;
    expect(f.meaning).toContain('original request');
  });

  it('identifies the opCode as OP_MSG (2013) little-endian', () => {
    const node = dissect(frame, 'mongodb', reg);
    // Wire bytes DD 07 00 00 read little-endian = 0x000007DD = 2013.
    expect(node.header.get('opCode')).toBe(2013);
    const f = node.header.fields.find((x) => x.field.name === 'opCode')!;
    expect(f.display).toBe('2013 (OP_MSG)');
  });

  it('field bit widths sum to exactly 16 bytes', () => {
    const totalBits = mongodb.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(16 * 8);
  });
});
