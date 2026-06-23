// LDAP — Lightweight Directory Access Protocol.
// RFC 4511 (LDAP v3 protocol). LDAP runs over TCP, well-known port 389 (and
// LDAPS / LDAP-over-TLS on 636). Every message is ASN.1 BER:
//
//   LDAPMessage ::= SEQUENCE {
//        messageID       MessageID,         -- INTEGER (0 .. 2147483647)
//        protocolOp      CHOICE {           -- the actual operation, e.g.
//             bindRequest    [APPLICATION 0]  BindRequest,
//             searchRequest  [APPLICATION 3]  SearchRequest, ... },
//        controls       [0] Controls OPTIONAL }
//
// WHY THIS SPEC MODELS ONLY THE FIXED PREFIX
// ------------------------------------------
// BER is a recursive Type-Length-Value (TLV) stream, not a flat grid of
// fixed-width bit-fields. Every element is "tag byte, length byte(s), value",
// and BER lengths are themselves variable (short form 0x00-0x7F = one byte, or
// long form 0x81-0x84 + N bytes). So neither the protocolOp's position nor the
// fields nested inside it live at a fixed bit offset — they depend on the
// lengths that came before. That cannot be transcribed honestly as fixed-width
// `Field`s (exactly the situation in src/protocols/snmp.ts).
//
// So we model ONLY the part that is positionally fixed at the very start of
// every LDAPMessage: the outer SEQUENCE TLV header and the messageID INTEGER
// TLV. These five bytes are deterministic for a normal message — the outer
// SEQUENCE length is short-form for any message < 128 bytes, and the messageID
// of a typical client session fits in one byte (1, 2, 3, ...). After them the
// protocolOp follows as the payload, whose first byte IS its application tag:
// 0x60 = BindRequest, 0x61 = BindResponse, 0x63 = SearchRequest, etc. The byte
// view then shows the real protocolOp tag directly, so a learner can read which
// operation this is from the wire rather than against invented offsets.
//
// CAVEAT (documented honestly): headerBytes() => 5 assumes the outer SEQUENCE
// uses BER short-form length (message < 128 bytes) and a 1-byte messageID. A
// larger message or a multi-byte messageID would shift these bytes; we do not
// parse long-form here. We stop dissecting at the wrapper (next => null)
// because the protocolOp is a recursive BER structure with no fixed grid.
import type { ProtocolSpec } from '../core/types';

// protocolOp application-tag bytes. ASN.1 tag byte = [class(2) | P/C(1) | num(5)].
// APPLICATION class = 0b01, so tags are 0x40 + (constructed ? 0x20 : 0) + number.
// Per RFC 4511 every protocolOp is a SEQUENCE (constructed) EXCEPT UnbindRequest
// (NULL) and DelRequest (LDAPDN OCTET STRING), which are primitive.
const PROTOCOL_OP: Record<number, string> = {
  0x60: 'bindRequest [APPLICATION 0]',
  0x61: 'bindResponse [APPLICATION 1]',
  0x42: 'unbindRequest [APPLICATION 2] (primitive)',
  0x63: 'searchRequest [APPLICATION 3]',
  0x64: 'searchResEntry [APPLICATION 4]',
  0x65: 'searchResDone [APPLICATION 5]',
  0x66: 'modifyRequest [APPLICATION 6]',
  0x67: 'modifyResponse [APPLICATION 7]',
  0x68: 'addRequest [APPLICATION 8]',
  0x69: 'addResponse [APPLICATION 9]',
  0x4a: 'delRequest [APPLICATION 10] (primitive)',
  0x6b: 'delResponse [APPLICATION 11]',
  0x6c: 'modDNRequest [APPLICATION 12]',
  0x6d: 'modDNResponse [APPLICATION 13]',
  0x6e: 'compareRequest [APPLICATION 14]',
  0x6f: 'compareResponse [APPLICATION 15]',
  0x50: 'abandonRequest [APPLICATION 16] (primitive)',
  0x73: 'searchResRef [APPLICATION 19]',
  0x77: 'extendedReq [APPLICATION 23]',
  0x78: 'extendedResp [APPLICATION 24]',
  0x79: 'intermediateResponse [APPLICATION 25]',
};

export const ldap: ProtocolSpec = {
  id: 'ldap',
  name: 'LDAP',
  layer: 7,
  summary:
    'A TCP application protocol (port 389; LDAPS/StartTLS for encryption) for querying and modifying a directory — users, groups, machines, X.500-style hierarchies (the backbone of Active Directory and OpenLDAP). Every message is ASN.1 BER: a recursive Type-Length-Value stream wrapping a messageID and a protocolOp (Bind, Search, Modify, ...). Apex models the fixed outer SEQUENCE + messageID TLV; the protocolOp follows as the raw BER payload, its first byte being the operation tag (0x60 = BindRequest, 0x63 = SearchRequest, ...).',
  fields: [
    {
      name: 'seqTag',
      label: 'SEQUENCE tag',
      bits: 8,
      type: 'hex',
      note: 'BER universal tag 0x30 = SEQUENCE (constructed). Every LDAPMessage starts here.',
      desc: 'The first byte of every LDAP message: the ASN.1 BER tag 0x30, meaning a constructed SEQUENCE. It opens the LDAPMessage that contains the messageID and the protocolOp.',
      detail: `SEQUENCE TAG (0x30):

ASN.1 BER tag bytes are bit-packed: [class(2) | P/C(1) | number(5)].
0x30 = 0b00 1 10000:
- class    00  = universal
- P/C       1  = constructed (it CONTAINS other TLVs, vs primitive)
- number 10000 = 16 = SEQUENCE

RFC 4511 defines the whole message as:
  LDAPMessage ::= SEQUENCE { messageID MessageID, protocolOp CHOICE { ... }, ... }
so the outermost element is always a SEQUENCE, and the very first transmitted
byte is therefore always 0x30 for a well-formed LDAP message.`,
    },
    {
      name: 'seqLen',
      label: 'SEQUENCE length',
      bits: 8,
      decode: (v) => (v < 0x80 ? `${v} bytes (short form)` : 'long form — not modeled here'),
      note: 'BER length of the message body (messageID + protocolOp). Short form (< 128 bytes) assumed.',
      desc: 'The BER length of everything inside the outer SEQUENCE (the messageID TLV plus the protocolOp). Shown here as a single short-form byte (0x00-0x7F = 0-127 bytes), which covers small binds and abandons; larger operations use long form.',
      detail: `BER LENGTH ENCODING:

SHORT FORM (one byte, 0x00-0x7F):
  the byte IS the length, 0-127. Used when the contents are < 128 bytes.

LONG FORM (0x81-0x84 then N length bytes):
  the low 7 bits of the first byte give the NUMBER of following length bytes,
  e.g. 0x81 0x96 = 0x96 = 150 bytes; 0x82 0x01 0x2C = 300 bytes.

This field models only the SHORT FORM. A larger message (a SearchRequest with a
big filter, an AddRequest with many attributes) would use the long form, the
outer header would be longer than 5 bytes, and these offsets would shift — that
case is intentionally left to the payload rather than parsed incorrectly. A
simple anonymous Bind or an Unbind is well under 128 bytes, so short form is the
common case shown here.`,
    },
    {
      name: 'msgIdTag',
      label: 'messageID tag',
      bits: 8,
      type: 'hex',
      note: 'BER universal tag 0x02 = INTEGER. The first element inside the SEQUENCE.',
      desc: 'The ASN.1 BER tag 0x02, meaning a primitive INTEGER. It introduces the messageID — the first element inside the LDAPMessage SEQUENCE.',
      detail: `INTEGER TAG (0x02):

0x02 = 0b00 0 00010:
- class    00  = universal
- P/C       0  = primitive (holds a value directly, not nested TLVs)
- number 00010 = 2 = INTEGER

Per RFC 4511 the first member of the LDAPMessage SEQUENCE is "messageID
MessageID", and MessageID ::= INTEGER (0 .. 2147483647), so the byte immediately
after the outer SEQUENCE length is always this INTEGER tag.`,
    },
    {
      name: 'msgIdLen',
      label: 'messageID length',
      bits: 8,
      decode: (v) => `${v} byte${v === 1 ? '' : 's'}`,
      note: 'BER length of the messageID integer. This spec assumes 1 byte (id 1-127).',
      desc: 'The BER length of the messageID integer. A fresh client connection numbers its requests 1, 2, 3, ..., so early messages have a single-byte ID; busy sessions eventually need 2+ bytes (the messageID can reach 2,147,483,647).',
      detail: `messageID LENGTH:

BER encodes an INTEGER in the minimum number of two's-complement bytes. A client
assigns each outstanding request a unique messageID, starting at 1 and
incrementing, so the IDs of an early session fit in one byte. This spec models
the 1-byte case; a long-running session whose ID climbs past 127 would encode it
in 2+ bytes, shifting the messageID value field and everything after it.

messageID 0 is RESERVED for unsolicited notifications sent by the server (e.g.
the "Notice of Disconnection" extended response), never used by a client request.`,
    },
    {
      name: 'messageId',
      label: 'messageID',
      bits: 8,
      note: 'Per-request ID; the matching response echoes it. Assumes a 1-byte value here.',
      desc: 'The message identifier. Because LDAP allows many requests to be in flight on one connection at once, the client tags each request with a unique ID and the server echoes that same ID in every response (and in any intermediate/referral messages), so the client can match answers to questions.',
      detail: `messageID:

LDAP is asynchronous: a client may pipeline several operations on a single TCP
connection without waiting for each reply. The messageID is how request and
response are correlated — a SearchResultEntry, the final SearchResultDone, and a
matching ExtendedResponse all carry the messageID of the request that triggered
them.

RULES (RFC 4511 sec 4.1.1.1):
- 0 is reserved for the server's unsolicited notifications.
- A client must not reuse a messageID for a new request while an operation with
  that ID is still outstanding on the same connection.
- The space is INTEGER (0 .. 2147483647); clients typically start at 1 and count
  up. This spec assumes the value still fits in one byte.`,
    },
  ],
  // The outer SEQUENCE TLV (tag+len = 2 bytes) plus the messageID INTEGER TLV
  // (tag+len+value = 3 bytes) = 5 fixed bytes, ASSUMING BER short-form length
  // and a 1-byte messageID. See the top-of-file caveat. The protocolOp follows
  // as the raw BER payload, its first byte being the operation's application tag.
  headerBytes: () => 5,
  // The protocolOp (BindRequest 0x60, SearchRequest 0x63, ...) is a recursive
  // BER TLV structure, not a fixed grid, so we stop here and let it fall through
  // as node.payload. PROTOCOL_OP documents the operation tag bytes for readers.
  next: () => null,
};

export { PROTOCOL_OP as LDAP_PROTOCOL_OP };
