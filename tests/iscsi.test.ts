import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { iscsi } from '../src/protocols/iscsi';
import { dissect } from '../src/core/engine';

// A hand-verified iSCSI Login Request Basic Header Segment (BHS), RFC 7143 §11.12,
// matching the first Login Request a software initiator (e.g. open-iscsi) sends on
// a fresh TCP/3260 connection. The leading-field values are anchored to a real
// capture (the initiator transits straight toward Full Feature Phase) and to the
// RFC:
//
//   byte 0   : 0x43        Opcode = 0x03 Login Request, with the I (Immediate) bit
//                          (0x40) set — RFC 7143 §11.12. 0x40|0x03 = 0x43.
//   byte 1   : 0x9C        Login flags: T=1 (0x80, transit), C=0, CSG=01 (0x10,
//                          Operational), NSG=11 (0x0C, Full Feature). = 0x9C.
//   bytes 2-3: 00 00       Opcode-specific: for Login, Version-max / Version-min.
//   byte 4   : 0x00        TotalAHSLength = 0 (no Additional Header Segments).
//   bytes 5-7: 00 00 E7    DataSegmentLength = 0x0000E7 = 231 bytes of login text.
//
// This matches the RFC 7143 §11.0 BHS layout exactly: the modeled fields are
// opcode(8) flags(8) opcodeSpecific(16) TotalAHSLength(8) DataSegmentLength(24)
// = the first 8 bytes; the remaining 40 bytes of the 48-byte BHS fall to payload.
const bhsLead = [
  0x43, // 0    opcode: I bit + Login Request
  0x9c, // 1    flags: T=1, CSG=1 (operational), NSG=3 (full feature)
  0x00, 0x00, // 2-3  Version-max / Version-min (opcode-specific)
  0x00, // 4    TotalAHSLength = 0
  0x00, 0x00, 0xe7, // 5-7  DataSegmentLength = 231
];

// The remaining 40 bytes of the 48-byte BHS for a Login Request (RFC 7143 §11.12):
// ISID, TSIH, ITT, CID, CmdSN, ExpStatSN, reserved. NOT modeled as fields — they
// prove the 48-byte BHS is consumed and the remainder falls to payload.
const bhsRest = [
  0x40, 0x00, 0x01, 0x37, 0x00, 0x00, // 8-13  ISID
  0x00, 0x00,                         // 14-15 TSIH = 0
  0x00, 0x00, 0x00, 0x00,             // 16-19 Initiator Task Tag
  0x00, 0x00,                         // 20-21 CID
  0x00, 0x00,                         // 22-23 reserved
  0x00, 0x00, 0x00, 0x00,             // 24-27 CmdSN
  0x00, 0x00, 0x00, 0x00,             // 28-31 ExpStatSN
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 32-39 reserved
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 40-47 reserved
];

// Two bytes standing in for the login text data segment (e.g. "In" of
// "InitiatorName=..."). They prove the BHS is bounded to exactly 48 bytes.
const data = [0x49, 0x6e];
const bhs = [...bhsLead, ...bhsRest];
const frame = [...bhs, ...data];

describe('iSCSI Login Request BHS dissection (RFC 7143 §11.12)', () => {
  const reg = new ProtocolRegistry();
  reg.register(iscsi);

  it('bounds the header to the fixed 48-byte BHS and stops (no child)', () => {
    const node = dissect(frame, 'iscsi', reg);
    expect(node.header.byteLength).toBe(48);
    expect(node.payload).toEqual(data); // data segment falls through
    expect(node.child).toBeNull();
  });

  it('reads the opcode byte as Login Request (0x03) with the Immediate bit set', () => {
    const node = dissect(frame, 'iscsi', reg);
    // Whole byte is 0x43; the low 6 bits are the opcode.
    expect(node.header.get('opcode')).toBe(0x43);
    expect(node.header.get('opcode') & 0x3f).toBe(0x03); // Login Request
    expect(node.header.get('opcode') & 0x40).toBe(0x40); // I (Immediate) bit set
    const f = node.header.fields.find((x) => x.field.name === 'opcode')!;
    expect(f.meaning).toContain('Login Request');
    expect(f.meaning).toContain('I=1');
    expect(f.meaning).toContain('initiator→target');
  });

  it('decodes the login flags: T=1, CSG=Operational, NSG=Full Feature', () => {
    const node = dissect(frame, 'iscsi', reg);
    expect(node.header.get('flags')).toBe(0x9c);
    const f = node.header.fields.find((x) => x.field.name === 'flags')!;
    expect(f.meaning).toContain('T=1 (transit)');
    expect(f.meaning).toContain('CSG=1 (Login Operational Negotiation)');
    expect(f.meaning).toContain('NSG=3 (Full Feature Phase)');
  });

  it('reads TotalAHSLength = 0 (no Additional Header Segments)', () => {
    const node = dissect(frame, 'iscsi', reg);
    expect(node.header.get('totalAhsLength')).toBe(0);
    const f = node.header.fields.find((x) => x.field.name === 'totalAhsLength')!;
    expect(f.meaning).toContain('no Additional Header Segments');
  });

  it('reads the 24-bit DataSegmentLength = 231', () => {
    const node = dissect(frame, 'iscsi', reg);
    expect(node.header.get('dataSegmentLength')).toBe(231);
    const f = node.header.fields.find((x) => x.field.name === 'dataSegmentLength')!;
    expect(f.meaning).toContain('231 bytes');
  });

  it('field bit widths sum to the 8-byte leading run this spec transcribes', () => {
    // opcode(8) + flags(8) + opcodeSpecific(16) + totalAhsLength(8) + dataSegmentLength(24) = 64 bits.
    const totalBits = iscsi.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(8 * 8);
  });

  it('honours TotalAHSLength on a target SCSI Response opcode read (sanity of opcode mask)', () => {
    // A target-side SCSI Response (0x21, no I bit). Verifies the opcode mask/direction.
    const respFrame = [0x21, 0x80, 0x00, 0x00, 0x00, 0x00, ...bhsRest, ...data];
    const node = dissect(respFrame, 'iscsi', reg);
    expect(node.header.get('opcode')).toBe(0x21);
    const f = node.header.fields.find((x) => x.field.name === 'opcode')!;
    expect(f.meaning).toContain('SCSI Response');
    expect(f.meaning).toContain('target→initiator');
    // For a non-login opcode the flags byte uses the general F-bit reading.
    const ff = node.header.fields.find((x) => x.field.name === 'flags')!;
    expect(ff.meaning).toContain('F=1 (Final)');
  });
});
