// iSCSI — Internet Small Computer Systems Interface. RFC 7143 (the consolidated
// iSCSI specification, Apr 2014, which obsoletes RFC 3720/3721/3980/4850/5048).
// iSCSI carries SCSI commands and data over TCP — it lets an initiator (host)
// use a remote target's block storage as if it were a local disk. It listens on
// TCP port 3260 (registered with IANA).
//
// THE BASIC HEADER SEGMENT (BHS), RFC 7143 §11.0
// ----------------------------------------------
// Every iSCSI PDU begins with a fixed 48-byte Basic Header Segment. After the
// BHS may come, in order: zero or more Additional Header Segments (AHSs, length
// = TotalAHSLength*4 bytes), an optional 4-byte HeaderDigest (CRC-32C if
// negotiated), the Data Segment (DataSegmentLength bytes, padded to a 4-byte
// boundary), and an optional 4-byte DataDigest. The general BHS layout is:
//
//    Byte/     0                   1                   2                   3
//       /     7 6 5 4 3 2 1 0|7 6 5 4 3 2 1 0|7 6 5 4 3 2 1 0|7 6 5 4 3 2 1 0
//      +------+---------------+---------------+---------------+--------------+
//   0  |.|I|  Opcode         | Opcode-specific fields (incl. F/Final bit)   |
//      +------+---------------+---------------+---------------+--------------+
//   4  |TotalAHSLength |            DataSegmentLength (24 bits)             |
//      +------+---------------+---------------+---------------+--------------+
//   8  | LUN or Opcode-specific fields (8 bytes)                           |
//      +------+----------------------------------------------------------- +
//  16  | Initiator Task Tag (ITT)                                          |
//      +------+----------------------------------------------------------- +
//  20  | Opcode-specific fields (28 bytes, through byte 47)                |
//      +------+----------------------------------------------------------- +
//
// NOTE on the byte map above: the first *word* is Opcode (byte 0) then three
// opcode-specific bytes (bytes 1-3). DataSegmentLength is the low 24 bits of the
// *second* word (bytes 5-7), with TotalAHSLength in byte 4. To keep the engine's
// bit grid exact we transcribe the leading run as: opcode(8) at byte 0, an
// 8-bit opcode-specific Flags byte at byte 1 (whose MSB is the F/Final bit for
// most PDUs), then — because bytes 2-3 are opcode-specific and bytes 6-7 vary by
// PDU too — we transcribe the two universally-positioned length fields,
// TotalAHSLength (byte 4) and DataSegmentLength (bytes 5-7). Bytes 2-3 between
// Flags and TotalAHSLength are themselves opcode-specific; modeling them as named
// fields would lie about the wire, so they are covered by the note and fall under
// the opcode-specific remainder. This spec therefore transcribes the four fields
// the task and RFC fix in place — Opcode, Flags, TotalAHSLength, DataSegmentLength
// — and lets the rest of the 48-byte BHS (LUN/opcode-specific, ITT, etc.) plus
// the AHSs/digests/data fall into node.payload (see headerBytes and `next`).
//
// LOGIN REQUEST (opcode 0x03, RFC 7143 §11.12): byte 0 = 0x43 because the I
// (Immediate) bit "MUST always be 1 for Login Requests"; byte 1 is not a generic
// F-bit byte but T(Transit)/C(Continue)/CSG/NSG — see the Flags field note.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// RFC 7143 §11.0 / Appendix: the 6-bit Opcode (low 6 bits of byte 0). Initiator
// opcodes have bit 5 = 0; target opcodes have bit 5 = 1 (>= 0x20). The 0x40
// (Immediate) bit in byte 0 is NOT part of the opcode and is masked off before
// this lookup.
const OPCODE: Record<number, string> = {
  0x00: 'NOP-Out',
  0x01: 'SCSI Command',
  0x02: 'SCSI Task Management Function Request',
  0x03: 'Login Request',
  0x04: 'Text Request',
  0x05: 'SCSI Data-Out (write data)',
  0x06: 'Logout Request',
  0x10: 'SNACK Request',
  0x20: 'NOP-In',
  0x21: 'SCSI Response',
  0x22: 'SCSI Task Management Function Response',
  0x23: 'Login Response',
  0x24: 'Text Response',
  0x25: 'SCSI Data-In (read data)',
  0x26: 'Logout Response',
  0x31: 'Reject',
  0x32: 'Asynchronous Message',
};

// iSCSI login negotiation stages (CSG / NSG, 2 bits each), RFC 7143 §11.12.
const STAGE: Record<number, string> = {
  0: 'Security Negotiation',
  1: 'Login Operational Negotiation',
  3: 'Full Feature Phase',
  // value 2 is reserved
};

export const iscsi: ProtocolSpec = {
  id: 'iscsi',
  name: 'iSCSI',
  layer: 7,
  summary:
    'Internet SCSI (RFC 7143): SCSI block-storage commands carried over TCP (port 3260), so a host can use a remote disk as if it were local. Every PDU starts with a fixed 48-byte Basic Header Segment; this spec transcribes its leading fields — opcode (with the Immediate bit), the opcode-specific flags, and the AHS/data lengths — and lets the rest of the BHS and the data segment fall through as payload.',
  fields: [
    {
      name: 'opcode',
      label: 'Opcode',
      bits: 8,
      type: 'enum',
      // The low 6 bits select the PDU type; bit 6 (0x40) is the Immediate flag and
      // bit 7 (0x80) is reserved. Decode masks 0x3F so the I bit doesn't shift the
      // lookup, and reports the I bit separately.
      enumMap: OPCODE,
      decode: (v) => {
        const op = v & 0x3f;
        const name = OPCODE[op] ?? `unknown 0x${op.toString(16).padStart(2, '0')}`;
        const i = (v & 0x40) ? ', I=1 (Immediate)' : '';
        const dir = op >= 0x20 ? 'target→initiator' : 'initiator→target';
        return `0x${v.toString(16).padStart(2, '0')} → opcode 0x${op
          .toString(16)
          .padStart(2, '0')} ${name} (${dir})${i}`;
      },
      note: 'Byte 0: bit7 reserved, bit6 = I (Immediate), bits5-0 = the 6-bit opcode (e.g. 0x03 Login Request; 0x43 on the wire = I bit + 0x03).',
      desc: 'The first byte of every iSCSI PDU. Its low 6 bits are the opcode naming the PDU type (Login Request 0x03, SCSI Command 0x01, SCSI Data-In 0x25, …); bit 6 is the Immediate (I) bit; bit 7 is reserved. Opcodes 0x00–0x1F flow initiator→target; 0x20–0x3F flow target→initiator.',
      detail: `OPCODE BYTE (byte 0, RFC 7143 §11.0):
- Bit 7 (0x80): reserved (must be 0).
- Bit 6 (0x40): I — IMMEDIATE delivery. An immediate command is acted on without waiting in the command-ordering queue; it still carries the current CmdSN but does not consume one. The I bit "MUST always be 1 for Login Requests" (§11.12), so a Login Request appears on the wire as 0x43 (0x40 | 0x03), not 0x03.
- Bits 5-0 (0x3F): the 6-bit OPCODE.

INITIATOR→TARGET opcodes (bit 5 = 0):
0x00 NOP-Out | 0x01 SCSI Command | 0x02 Task Mgmt Request | 0x03 Login Request
0x04 Text Request | 0x05 SCSI Data-Out | 0x06 Logout Request | 0x10 SNACK Request

TARGET→INITIATOR opcodes (bit 5 = 1, i.e. >= 0x20):
0x20 NOP-In | 0x21 SCSI Response | 0x22 Task Mgmt Response | 0x23 Login Response
0x24 Text Response | 0x25 SCSI Data-In | 0x26 Logout Response | 0x31 Reject | 0x32 Async Message

The decode masks off 0x40 before the name lookup so the Immediate bit never shifts the opcode, and reports I and the direction separately.`,
    },
    {
      name: 'flags',
      label: 'Opcode-specific flags',
      bits: 8,
      type: 'flags',
      // Generic interpretation: the MSB (0x80) is the F (Final) bit for most PDUs.
      // For Login/Text PDUs the byte is reinterpreted (see decode and note).
      flagBits: ['F', '', '', '', '', '', '', ''],
      decode: (v, h) => {
        const op = h.get('opcode') & 0x3f;
        if (op === 0x03 || op === 0x23) {
          // Login Request/Response: T C CSG(2) NSG(2) rr  (RFC 7143 §11.12/§11.13)
          const t = (v & 0x80) ? 'T=1 (transit)' : 'T=0';
          const c = (v & 0x40) ? ', C=1 (continue)' : '';
          const csg = (v & 0x30) >> 4;
          const nsg = (v & 0x0c) >> 2;
          return `0x${v.toString(16).padStart(2, '0')}: ${t}${c}, CSG=${csg} (${
            STAGE[csg] ?? 'reserved'
          }), NSG=${nsg} (${STAGE[nsg] ?? 'reserved'})`;
        }
        const f = (v & 0x80) ? 'F=1 (Final)' : 'F=0';
        return `0x${v.toString(16).padStart(2, '0')}: ${f}${
          v & 0x7f ? ' (+ opcode-specific bits)' : ''
        }`;
      },
      note: 'Byte 1, opcode-specific. For most PDUs bit7 = F (Final). For Login/Text it is T(transit) C(continue) CSG[5:4] NSG[3:2] — see decode.',
      desc: 'The second byte holds flags whose meaning depends on the opcode. For the common case its most-significant bit is the F (Final) bit, marking the last PDU of a sequence. For a Login Request/Response this byte instead carries the login state machine: T (Transit), C (Continue), and the 2-bit CSG (Current Stage) and NSG (Next Stage).',
      detail: `OPCODE-SPECIFIC FLAGS (byte 1, RFC 7143 §11.0):
The bit meanings are per-opcode. The two most common interpretations:

GENERAL / F BIT (bit 7, 0x80): the F (Final) bit. Set on the last PDU of a sequence — e.g. the final SCSI Data-Out of an unsolicited burst, or the final Data-In of a read. Lower bits carry per-opcode flags (e.g. SCSI Command's R/W read/write bits and 3-bit task ATTR; SCSI Data-In's A/O/U/S status bits).

LOGIN REQUEST / RESPONSE (opcode 0x03 / 0x23, §11.12): this byte is the login state machine, NOT a plain F byte:
- bit 7 (0x80) T — Transit: the initiator is ready to move to the stage named by NSG.
- bit 6 (0x40) C — Continue: this login PDU's text is incomplete; more PDUs follow (set when parameters span multiple PDUs).
- bits 5-4 (0x30) CSG — Current Stage.
- bits 3-2 (0x0C) NSG — Next Stage.
- bits 1-0 reserved.
Stages: 0 = SecurityNegotiation, 1 = LoginOperationalNegotiation, 3 = FullFeaturePhase (2 reserved). Login walks 0→1→3 (or skips Security). When T=1 and CSG/NSG advance the target moves the session forward; a final Login Response with NSG=3 puts the connection into Full Feature Phase, after which real SCSI commands flow.

The flagBits grid labels bit 7 as F (the general case); the decode switches to the T/C/CSG/NSG reading when the opcode is Login (0x03/0x23).`,
    },
    {
      name: 'opcodeSpecific',
      label: 'Opcode-specific',
      bits: 16,
      type: 'hex',
      note: 'Bytes 2-3: opcode-specific fields (e.g. CID for a Login Request; reserved for many PDUs).',
      desc: 'Two bytes whose meaning depends on the opcode. For a Login Request byte 2 carries the CID (Connection ID); for other PDUs these are reserved or small opcode-specific values. They sit between the flags byte and TotalAHSLength.',
      detail: `OPCODE-SPECIFIC (bytes 2-3, RFC 7143 §11.0): the BHS layout is byte 0 = opcode, byte 1 = opcode-specific flags, bytes 2-3 = further opcode-specific fields, then the common TotalAHSLength (byte 4) and DataSegmentLength (bytes 5-7). Modeling these two bytes keeps the length fields at their correct wire offsets.

For a Login Request (0x03) byte 2 is the CID (Connection ID) and byte 3 is reserved. Many other PDUs leave these reserved (0).`,
    },
    {
      name: 'totalAhsLength',
      label: 'TotalAHSLength',
      bits: 8,
      decode: (v) => (v === 0 ? '0 (no Additional Header Segments)' : `${v} × 4 = ${v * 4} bytes of AHS follow the BHS`),
      note: 'Byte 4: total length of all Additional Header Segments, in units of 4-byte words (0 = none).',
      desc: 'The total length of all Additional Header Segments (AHSs) that follow the 48-byte BHS, expressed in 4-byte words. Most PDUs use no AHS (value 0); AHSs carry things like an extended CDB or bidirectional read length for large SCSI commands.',
      detail: `TotalAHSLength (byte 4, 8-bit unsigned, RFC 7143 §11.0):
"Total length of all AHS header segments in units of four-byte words including padding, if any." So the AHS region is exactly TotalAHSLength * 4 bytes, located immediately after the 48-byte BHS.

ADDITIONAL HEADER SEGMENTS carry data that doesn't fit the fixed BHS:
- Extended CDB AHS (type 0x01) — a SCSI CDB longer than the 16 bytes the BHS reserves.
- Bidirectional Expected Read-Data Length AHS (type 0x02) — for bidirectional commands.

Most PDUs (including this Login Request) have no AHS, so the field is 0. In the Apex model the AHS bytes — when present — are part of node.payload after the 48-byte BHS; this field tells a reader how many of those bytes are AHS versus data.`,
    },
    {
      name: 'dataSegmentLength',
      label: 'DataSegmentLength',
      bits: 24,
      decode: (v) => `${v} bytes of data segment (padded to a 4-byte boundary on the wire)`,
      note: 'Bytes 5-7: length in BYTES of the data segment that follows the header (and any AHS + HeaderDigest).',
      desc: 'The length, in bytes, of the Data Segment carried after the header region. For a Login Request this is the login parameter key=value text (e.g. InitiatorName, AuthMethod). The data on the wire is padded with up to 3 zero bytes to a 4-byte boundary, but this field counts only the real data.',
      detail: `DataSegmentLength (bytes 5-7, 24-bit unsigned, RFC 7143 §11.0):
"This is the data segment payload length in bytes (excluding padding). The DataSegmentLength MUST be 0 whenever the PDU has no data segment."

WHERE THE DATA SITS: after the BHS (48 B), after any AHSs (TotalAHSLength*4 B), and after the optional 4-byte HeaderDigest. The data segment itself is then padded with 0-3 zero bytes up to a 4-byte boundary, optionally followed by a 4-byte DataDigest. This field counts only the unpadded payload.

24 BITS / MAX: the field caps a single PDU's data at 2^24 - 1 = 16,777,215 bytes, but the negotiated MaxRecvDataSegmentLength (default 8192) usually bounds it far lower; larger transfers are split across multiple Data-In/Data-Out PDUs.

FOR THIS LOGIN REQUEST: the data segment is the text login parameters (InitiatorName=…, SessionType=…, AuthMethod=…), so DataSegmentLength is non-zero. In the Apex model these bytes are part of node.payload (this spec stops at the 48-byte BHS).`,
    },
  ],
  // The Basic Header Segment is a fixed 48 bytes (RFC 7143 §11.0). Everything
  // after it — the rest of the opcode-specific BHS bytes are inside these 48; then
  // any AHSs (TotalAHSLength*4), an optional HeaderDigest, the Data Segment
  // (DataSegmentLength, 4-byte padded) and an optional DataDigest — is variable,
  // depends on negotiated digests, and is not a fixed bit grid, so it falls
  // through as node.payload. We model the leading fixed fields only.
  headerBytes: (): number => 48,
  // The data segment is SCSI CDB / login text / read-write block data, not a
  // further dissectable network protocol, so dissection stops at the BHS.
  next: (_h: ParsedHeader): string | null => null,
};
