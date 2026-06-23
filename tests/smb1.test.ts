import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { smb1 } from '../src/protocols/smb1';
import { dissect } from '../src/core/engine';

// A hand-verified SMB1 (CIFS) SMB_COM_NEGOTIATE Request header — the fixed 32-byte
// SMB header, [MS-CIFS] 2.2.3.1 — the first message a client sends on a fresh
// TCP/139 or /445 connection. We model from the 0xFF "SMB" marker; the 4-byte
// NetBIOS Session Service / Direct-TCP length prefix that precedes it on the wire
// is out of scope (transport framing).
//
// SMB1 multi-byte integer fields are LITTLE-ENDIAN on the wire (like SMB2); the
// spec marks each such field endian:'le' so the engine reads the true value
// directly. Assertions below are anchored to the REAL wire bytes and to [MS-CIFS].
//
// Offsets / fields ([MS-CIFS] 2.2.3.1), little-endian on the wire:
//   0  FF 53 4D 42              Protocol = 0xFF 'S' 'M' 'B'
//   4  72                       Command = 0x72 SMB_COM_NEGOTIATE
//   5  00 00 00 00              Status = 0 (request: no error)
//   9  18                       Flags = 0x18 (CASE_INSENSITIVE | CANONICALIZED_PATHS)
//  10  01 40                    Flags2 = 0x4001 (LONG_NAMES | NT_STATUS)  (LE)
//  12  00 00                    PIDHigh = 0
//  14  00 00 00 00 00 00 00 00  SecurityFeatures = 0 (unsigned)
//  22  00 00                    Reserved = 0
//  24  00 00                    TID = 0 (no tree connected yet)
//  26  2f 4b                    PIDLow = 0x4B2F = 19247  (LE)
//  28  00 00                    UID = 0 (no session yet)
//  30  c5 5e                    MID = 0x5EC5 = 24261  (LE)
const header = [
  0xff, 0x53, 0x4d, 0x42, // Protocol  0xFF 'S' 'M' 'B'
  0x72,                   // Command   NEGOTIATE
  0x00, 0x00, 0x00, 0x00, // Status    0
  0x18,                   // Flags     0x18
  0x01, 0x40,             // Flags2    0x4001 (LE)
  0x00, 0x00,             // PIDHigh   0
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // SecurityFeatures 0
  0x00, 0x00,             // Reserved  0
  0x00, 0x00,             // TID       0
  0x2f, 0x4b,             // PIDLow    0x4B2F (LE)
  0x00, 0x00,             // UID       0
  0xc5, 0x5e,             // MID       0x5EC5 (LE)
];

// A couple of body bytes to prove the header is bounded to exactly 32 bytes and
// the command body falls through as payload. The first byte of a NEGOTIATE Request
// body is WordCount = 0 ([MS-CIFS] 2.2.4.52.1), followed by a 2-byte ByteCount.
const body = [0x00, 0x62, 0x00];
const frame = [...header, ...body];

describe('SMB1/CIFS SMB header dissection ([MS-CIFS] 2.2.3.1)', () => {
  const reg = new ProtocolRegistry();
  reg.register(smb1);

  it('parses the fixed 32-byte header and stops (no child)', () => {
    const node = dissect(frame, 'smb1', reg);
    expect(node.header.byteLength).toBe(32);
    // Header bounded to 32; the command body is the payload.
    expect(node.payload).toEqual(body);
    expect(node.child).toBeNull();
  });

  it('reads the 0xFF "SMB" marker (byte-defined, so big-endian is exact)', () => {
    const node = dissect(frame, 'smb1', reg);
    expect(node.header.get('protocol')).toBe(0xff534d42);
    const f = node.header.fields.find((x) => x.field.name === 'protocol')!;
    expect(f.display).toBe('0xFF534D42');
  });

  it('identifies the Command as SMB_COM_NEGOTIATE (0x72)', () => {
    const node = dissect(frame, 'smb1', reg);
    expect(node.header.get('command')).toBe(0x72);
    const f = node.header.fields.find((x) => x.field.name === 'command')!;
    expect(f.display).toBe('114 (SMB_COM_NEGOTIATE)');
  });

  it('Status is 0 in the request', () => {
    const node = dissect(frame, 'smb1', reg);
    expect(node.header.get('status')).toBe(0);
  });

  it('decodes the 1-byte Flags bitmask (0x18 = CASE_INSENSITIVE | CANONICALIZED_PATHS, REPLY clear)', () => {
    const node = dissect(frame, 'smb1', reg);
    expect(node.header.get('flags')).toBe(0x18);
    const f = node.header.fields.find((x) => x.field.name === 'flags')!;
    // 0x18 = 0x10 (CANONICALIZED_PATHS) | 0x08 (CASE_INSENSITIVE); REPLY (0x80) clear => a request.
    expect(f.meaning).toContain('CANONICALIZED_PATHS');
    expect(f.meaning).toContain('CASE_INSENSITIVE');
    expect(f.meaning).not.toContain('REPLY');
    expect(f.meaning).toContain('0x18');
  });

  it('reads Flags2 little-endian (wire 0x01 0x40 -> 0x4001 = LONG_NAMES | NT_STATUS)', () => {
    const node = dissect(frame, 'smb1', reg);
    // Wire bytes 0x01 0x40 read little-endian = 0x4001.
    expect(node.header.get('flags2')).toBe(0x4001);
    const f = node.header.fields.find((x) => x.field.name === 'flags2')!;
    expect(f.meaning).toContain('NT_STATUS');
    expect(f.meaning).toContain('LONG_NAMES');
    expect(f.meaning).toContain('0x4001');
  });

  it('models SecurityFeatures as 8 raw bytes (unsigned NEGOTIATE: all zero)', () => {
    const node = dissect(frame, 'smb1', reg);
    const sf = node.header.fields.find((x) => x.field.name === 'securityFeatures')!;
    expect(sf.bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('reads PIDLow and MID little-endian (PIDLow 0x4B2F, MID 0x5EC5)', () => {
    const node = dissect(frame, 'smb1', reg);
    // Wire bytes 0x2f 0x4b read little-endian = 0x4B2F.
    expect(node.header.get('pidLow')).toBe(0x4b2f);
    // Wire bytes 0xc5 0x5e read little-endian = 0x5EC5.
    expect(node.header.get('mid')).toBe(0x5ec5);
  });

  it('TID and UID are 0 before any tree connect / authentication', () => {
    const node = dissect(frame, 'smb1', reg);
    expect(node.header.get('tid')).toBe(0);
    expect(node.header.get('uid')).toBe(0);
    expect(node.header.get('pidHigh')).toBe(0);
  });

  it('field bit widths sum to exactly 32 bytes', () => {
    const totalBits = smb1.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(32 * 8);
  });
});
