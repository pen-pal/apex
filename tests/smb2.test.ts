import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { smb2 } from '../src/protocols/smb2';
import { dissect } from '../src/core/engine';

// A hand-verified SMB2 NEGOTIATE Request packet header (the SYNC 64-byte header,
// [MS-SMB2] 2.2.1.2), as the first message a client sends on a fresh TCP/445
// connection. We model from the 0xFE "SMB" marker; the 4-byte Direct-TCP/NBSS
// length prefix that precedes it on the wire is out of scope.
//
// SMB2 fields are LITTLE-ENDIAN on the wire; the spec marks each multi-byte field
// endian:'le' so the engine reads the true value directly. Assertions below are
// anchored to the REAL wire bytes (and to [MS-SMB2]).
//
// Offsets / fields ([MS-SMB2] 2.2.1.2), little-endian on the wire:
//   0  FE 53 4D 42              ProtocolId  = 0xFE 'S' 'M' 'B'
//   4  40 00                    StructureSize = 64           (LE)
//   6  01 00                    CreditCharge  = 1            (LE)
//   8  00 00 00 00              Status / ChannelSequence = 0
//  12  00 00                    Command = NEGOTIATE (0)      (LE)
//  14  01 00                    CreditRequest = 1            (LE)
//  16  00 00 00 00              Flags = 0 (a request: SERVER_TO_REDIR clear)
//  20  00 00 00 00              NextCommand = 0
//  24  00 00 00 00 00 00 00 00  MessageId = 0  (first message)
//  32  FF FE 00 00              Reserved/ProcessId = 0x0000FEFF (Windows sentinel, LE)
//  36  00 00 00 00              TreeId = 0
//  40  00 00 00 00 00 00 00 00  SessionId = 0  (no session yet, MUST be 0)
//  48  00 x16                   Signature = 0 (unsigned)
const header = [
  0xfe, 0x53, 0x4d, 0x42,
  0x40, 0x00,
  0x01, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00,
  0x01, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xfe, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];

// A couple of payload bytes to prove the header is bounded to exactly 64 bytes
// and the command body falls through as payload. The first two bytes are the
// SMB2 NEGOTIATE Request StructureSize (36, LE 0x24 0x00), [MS-SMB2] 2.2.3.
const body = [0x24, 0x00, 0x08, 0x00];
const frame = [...header, ...body];

describe('SMB2 SYNC header dissection ([MS-SMB2] 2.2.1.2)', () => {
  const reg = new ProtocolRegistry();
  reg.register(smb2);

  it('parses the fixed 64-byte header and stops (no child)', () => {
    const node = dissect(frame, 'smb2', reg);
    expect(node.header.byteLength).toBe(64);
    // Header bounded to 64; the command body is the payload.
    expect(node.payload).toEqual(body);
    expect(node.child).toBeNull();
  });

  it('reads the 0xFE "SMB" marker (byte-defined, so big-endian is exact)', () => {
    const node = dissect(frame, 'smb2', reg);
    expect(node.header.get('protocolId')).toBe(0xfe534d42);
    const f = node.header.fields.find((x) => x.field.name === 'protocolId')!;
    expect(f.display).toBe('0xFE534D42');
  });

  it('reads StructureSize little-endian (=64)', () => {
    const node = dissect(frame, 'smb2', reg);
    // Wire bytes 0x40 0x00 read little-endian = 64.
    expect(node.header.get('structureSize')).toBe(64);
    const f = node.header.fields.find((x) => x.field.name === 'structureSize')!;
    expect(f.display).toBe('64');
  });

  it('reads CreditCharge and CreditRequest little-endian (both 1)', () => {
    const node = dissect(frame, 'smb2', reg);
    // Wire bytes 0x01 0x00 read little-endian = 1.
    expect(node.header.get('creditCharge')).toBe(1);
    expect(node.header.get('creditRequest')).toBe(1);
    const cc = node.header.fields.find((x) => x.field.name === 'creditCharge')!;
    expect(cc.meaning).toContain('1 credit');
  });

  it('identifies the Command as NEGOTIATE (0)', () => {
    const node = dissect(frame, 'smb2', reg);
    expect(node.header.get('command')).toBe(0);
    const f = node.header.fields.find((x) => x.field.name === 'command')!;
    expect(f.display).toBe('0 (NEGOTIATE)');
  });

  it('shows Flags = none for a request (SERVER_TO_REDIR clear)', () => {
    const node = dissect(frame, 'smb2', reg);
    expect(node.header.get('flags')).toBe(0);
    const f = node.header.fields.find((x) => x.field.name === 'flags')!;
    // No flags set on a NEGOTIATE request.
    expect(f.display).toBe('none');
    expect(f.meaning).toContain('none');
    expect(f.meaning).toContain('0x00000000');
  });

  it('reads the Reserved/ProcessId Windows sentinel 0x0000FEFF (little-endian)', () => {
    const node = dissect(frame, 'smb2', reg);
    // Wire bytes FF FE 00 00 read little-endian = 0x0000FEFF.
    expect(node.header.get('reserved')).toBe(0x0000feff);
    const f = node.header.fields.find((x) => x.field.name === 'reserved')!;
    expect(f.display).toBe('0x0000FEFF');
  });

  it('models the 64- and 128-bit fields as raw bytes (NEGOTIATE: all zero)', () => {
    const node = dissect(frame, 'smb2', reg);
    const mid = node.header.fields.find((x) => x.field.name === 'messageId')!;
    const sid = node.header.fields.find((x) => x.field.name === 'sessionId')!;
    const sig = node.header.fields.find((x) => x.field.name === 'signature')!;
    expect(mid.bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]); // first message: MessageId 0
    expect(sid.bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]); // NEGOTIATE: SessionId MUST be 0
    expect(sig.bytes).toEqual(new Array(16).fill(0)); // unsigned: Signature MUST be 0
  });

  it('field bit widths sum to exactly 64 bytes', () => {
    const totalBits = smb2.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(64 * 8);
  });
});
