// SNMP — Simple Network Management Protocol.
// RFC 1157 (SNMPv1 message format: Message ::= SEQUENCE { version INTEGER,
//   community OCTET STRING, data PDU }).
// RFC 1901 (Community-based SNMPv2 / "v2c": same Message wrapper, version = 1).
// RFC 3411 (SNMP architecture: version 3 = 3). SNMP runs over UDP — requests to
// port 161 on the agent, traps/notifications to port 162 on the manager.
//
// WHY THIS SPEC MODELS ONLY THE OUTER WRAPPER
// -------------------------------------------
// SNMP is encoded in ASN.1 BER (Basic Encoding Rules): a recursive stream of
// Type-Length-Value (TLV) triplets, NOT a flat grid of fixed-width bit-fields.
// Every element is "tag byte, length byte(s), value":
//
//   Message ::= SEQUENCE {            -- TLV: tag 0x30, length, then the 3 below
//     version   INTEGER,              -- TLV: tag 0x02, length, value
//     community OCTET STRING,         -- TLV: tag 0x04, length, the bytes
//     data      PDU }                 -- TLV: a context tag (0xA0 = GetRequest,
//                                     --   0xA2 = GetResponse, 0xA3 = SetRequest…)
//                                     --   wrapping request-id, error-status,
//                                     --   error-index, and the variable-bindings
//                                     --   (a SEQUENCE OF { OID, value } pairs).
//
// A TLV's length is itself variable: BER "short form" (one byte, 0x00-0x7F) gives
// lengths 0-127, while "long form" (first byte 0x81-0x84, then 1-4 length bytes)
// is used for larger values. So neither the community string's position nor the
// PDU's position lives at a fixed bit offset — they depend on the lengths that
// came before. That cannot be transcribed honestly as fixed-width `Field`s.
//
// So we model ONLY the part that IS positionally fixed at the very start of every
// SNMP message: the outer SEQUENCE TLV header and the version INTEGER TLV. These
// five bytes are deterministic for a normal message (version length is always 1,
// and the outer SEQUENCE length is short-form for any message < 128 bytes, which
// covers typical single-OID Get/Set requests). Everything after — the community
// OCTET STRING and the data PDU — falls through as the payload, which IS the raw
// BER TLV stream. The byte view then shows the real tag/length bytes (0x04 = the
// OCTET STRING tag of the community, etc.) so a learner can read the TLV framing
// directly rather than against invented offsets.
//
// CAVEAT (documented honestly): headerBytes() => 5 assumes the outer SEQUENCE
// uses BER short-form length (message < 128 bytes) and version length = 1. For a
// larger message the outer length would be long-form and these 5 bytes would
// shift; we do not parse long-form here. We stop dissecting at the wrapper
// (next => null) because the community + PDU are a recursive BER structure with
// no fixed grid, exactly as documented above.
import type { ProtocolSpec } from '../core/types';

export const snmp: ProtocolSpec = {
  id: 'snmp',
  name: 'SNMP',
  layer: 7,
  summary:
    'A UDP application protocol (agent on port 161, traps on 162) for reading and writing managed-device state. The message is ASN.1 BER — a recursive Type-Length-Value stream — wrapping a version, a community string (the plaintext "password" in v1/v2c), and a PDU of OID/value variable-bindings. Apex models the fixed outer SEQUENCE + version TLV; the community and PDU follow as the raw BER payload.',
  fields: [
    {
      name: 'seqTag',
      label: 'SEQUENCE tag',
      bits: 8,
      type: 'hex',
      note: 'BER universal tag 0x30 = SEQUENCE (constructed). Every SNMP message starts here.',
      desc: 'The first byte of every SNMP message: the ASN.1 BER tag 0x30, meaning a constructed SEQUENCE. It opens the Message wrapper that contains the version, community, and PDU.',
      detail: `SEQUENCE TAG (0x30):

ASN.1 BER tag bytes are bit-packed: [class(2) | P/C(1) | number(5)].
0x30 = 0b00 1 10000:
- class    00  = universal
- P/C       1  = constructed (it CONTAINS other TLVs, vs primitive)
- number 10000 = 16 = SEQUENCE

RFC 1157 defines the whole message as:
  Message ::= SEQUENCE { version INTEGER, community OCTET STRING, data ANY }
so the outermost element is always a SEQUENCE, and the very first transmitted
byte is therefore always 0x30 for a well-formed SNMP message.`,
    },
    {
      name: 'seqLen',
      label: 'SEQUENCE length',
      bits: 8,
      decode: (v) => (v < 0x80 ? `${v} bytes (short form)` : 'long form — not modeled here'),
      note: 'BER length of the message body. This spec assumes short form (< 128 bytes).',
      desc: 'The BER length of everything inside the outer SEQUENCE (version + community + PDU). Shown here as a single short-form byte (0x00-0x7F = 0-127 bytes), which covers a typical single-OID request.',
      detail: `BER LENGTH ENCODING:

SHORT FORM (one byte, 0x00-0x7F):
  the byte IS the length, 0-127. Used when the contents are < 128 bytes.

LONG FORM (0x81-0x84 then N length bytes):
  the low 7 bits of the first byte give the NUMBER of following length bytes,
  e.g. 0x81 0x96 = 0x96 = 150 bytes; 0x82 0x01 0x2C = 300 bytes.

This field models only the SHORT FORM. A message of 128 bytes or more would use
the long form, the outer header would be longer than 5 bytes, and these offsets
would shift — that case is intentionally left to the payload rather than parsed
incorrectly. Most single-variable Get/GetNext/Set requests are well under 128
bytes, so short form is the common case shown here.`,
    },
    {
      name: 'versionTag',
      label: 'Version tag',
      bits: 8,
      type: 'hex',
      note: 'BER universal tag 0x02 = INTEGER. The first element inside the SEQUENCE.',
      desc: 'The ASN.1 BER tag 0x02, meaning a primitive INTEGER. It introduces the version field — the first element inside the message SEQUENCE.',
      detail: `INTEGER TAG (0x02):

0x02 = 0b00 0 00010:
- class    00  = universal
- P/C       0  = primitive (holds a value directly, not nested TLVs)
- number 00010 = 2 = INTEGER

Per RFC 1157 the first member of the Message SEQUENCE is "version INTEGER", so
the byte immediately after the outer SEQUENCE length is always this INTEGER tag.`,
    },
    {
      name: 'versionLen',
      label: 'Version length',
      bits: 8,
      decode: (v) => `${v} byte${v === 1 ? '' : 's'}`,
      note: 'Length of the version integer. Always 1 for the small values 0/1/3.',
      desc: 'The BER length of the version integer. The defined versions (0, 1, 3) all fit in a single byte, so this is 1 for any real SNMP message.',
      detail: `VERSION LENGTH:

BER encodes an INTEGER in the minimum number of two's-complement bytes. The
defined SNMP version values are 0 (v1), 1 (v2c) and 3 (v3) — all single-byte —
so this length is always 1 in practice. It is still transmitted explicitly
because INTEGER is a general type that could carry larger values.`,
    },
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      type: 'enum',
      enumMap: {
        0: 'SNMPv1 (RFC 1157)',
        1: 'SNMPv2c (RFC 1901)',
        3: 'SNMPv3 (RFC 3411)',
      },
      note: 'On the wire the value is one less than the marketing name: 0 = v1, 1 = v2c, 3 = v3.',
      desc: 'The SNMP protocol version. The encoded number is offset from the name: 0 means version 1, 1 means version 2c, and 3 means version 3. v1 and v2c authenticate only with the cleartext community string that follows.',
      detail: `VERSION VALUES:

  0 = SNMPv1   (RFC 1157) — the original; community string in cleartext.
  1 = SNMPv2c  (RFC 1901) — "community-based" v2: same Message wrapper and
                            same cleartext community, adds GetBulk and richer
                            error statuses. The most widely deployed version.
  3 = SNMPv3   (RFC 3411+) — adds the User-based Security Model: authentication
                            (HMAC) and privacy (encryption). Its message format
                            differs from this v1/v2c wrapper (the value 2 was
                            never assigned for the wire encoding).

SECURITY NOTE: in v1/v2c the community string immediately following is sent in
the clear, so anyone on the path can read it and replay requests. This is why
read/write SNMP over untrusted networks should use v3.`,
    },
  ],
  // The outer SEQUENCE TLV (tag+len = 2 bytes) plus the version INTEGER TLV
  // (tag+len+value = 3 bytes) = 5 fixed bytes, ASSUMING BER short-form lengths.
  // See the top-of-file caveat. The community OCTET STRING and the data PDU
  // follow as the raw BER payload.
  headerBytes: () => 5,
  // The community string + PDU are a recursive BER TLV structure, not a fixed
  // grid, so we stop here and let them fall through as node.payload.
  next: () => null,
};
