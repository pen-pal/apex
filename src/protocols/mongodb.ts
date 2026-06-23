// MongoDB Wire Protocol — the 16-byte standard message header (msgHeader).
// Authoritative reference: the MongoDB Wire Protocol specification
// (https://www.mongodb.com/docs/manual/reference/mongodb-wire-protocol/) and the
// per-opcode specs in the MongoDB source tree (rust-driver / mongo specifications,
// "Server Wire version" and OP_MSG documents). MongoDB is not an IETF protocol —
// it has no RFC; its authoritative wire definition is MongoDB's own published
// specification, transcribed verbatim below.
//
// TRANSPORT
// ---------
// The wire protocol runs over a regular TCP stream, by default on port 27017
// (also 27018/27019 for shard/config servers, 27017 for mongos). Every message —
// request or reply — begins with the same fixed 16-byte msgHeader:
//
//   struct MsgHeader {
//       int32   messageLength;  // total message size, INCLUDING these 16 bytes
//       int32   requestID;      // sender-chosen identifier for this message
//       int32   responseTo;     // the requestID of the message this replies to
//       int32   opCode;         // message type (see OPCODE below)
//   }
//
// ENDIANNESS
// ----------
// Like SMB2 (and unlike the IETF protocols Ethernet/IPv4/TCP), MongoDB stores
// ALL of its integer fields LITTLE-ENDIAN on the wire — it grew up as a C/C++
// project reading structs directly on little-endian (x86) hosts, and the same
// little-endianness extends into the BSON body that follows. Each 32-bit field
// below is therefore marked endian:'le' so the engine reads its true value
// directly (e.g. opCode wire bytes 0xDD 0x07 0x00 0x00 -> 2013 = OP_MSG).
//
// WHY ONLY THE HEADER
// -------------------
// This spec models the fixed 16-byte msgHeader only. What follows is the
// opcode-specific body — for the modern OP_MSG (2013) that is a 4-byte flagBits
// word followed by one or more "sections", each of which is (mostly) a BSON
// document. BSON is itself a length-prefixed, type-tagged binary format, not a
// fixed bit grid, so it cannot be transcribed honestly as Field entries — it
// falls through as node.payload (see the header `note` and `next: null`). The
// pduBytes hook bounds the whole message at messageLength so a following pipelined
// message in the same TCP segment does not leak into this one's payload.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// OpCode values. Modern MongoDB (5.1+) uses only OP_MSG (2013) for normal traffic
// and OP_COMPRESSED (2012) to wrap a compressed opcode; the OP_* request/reply
// opcodes (2001..2007) and the original OP_REPLY (1) are deprecated/removed but
// still appear in older captures and during the legacy hello/isMaster handshake.
// 1000 is the historic OP_MSG (a now-obsolete free-form message opcode, distinct
// from the modern 2013 OP_MSG).
const OPCODE: Record<number, string> = {
  1: 'OP_REPLY',          // legacy reply to OP_QUERY / OP_GET_MORE (removed 5.1)
  1000: 'OP_MSG (legacy)', // original generic message opcode (obsolete)
  2001: 'OP_UPDATE',      // deprecated (removed 5.1)
  2002: 'OP_INSERT',      // deprecated (removed 5.1)
  2004: 'OP_QUERY',       // deprecated; still used for hello/isMaster handshake
  2005: 'OP_GET_MORE',    // deprecated (removed 5.1)
  2006: 'OP_DELETE',      // deprecated (removed 5.1)
  2007: 'OP_KILL_CURSORS',// deprecated (removed 5.1)
  2012: 'OP_COMPRESSED',  // wraps another opcode's body, compressed
  2013: 'OP_MSG',         // the modern request/reply opcode
};

export const mongodb: ProtocolSpec = {
  id: 'mongodb',
  name: 'MongoDB',
  layer: 7,
  summary:
    'The MongoDB Wire Protocol message header: a fixed 16-byte msgHeader (messageLength, requestID, responseTo, opCode) that fronts every request and reply over TCP/27017. MongoDB stores its integers LITTLE-ENDIAN on the wire, read here via the engine\'s endian:\'le\' hook; the opcode-specific BSON body that follows falls through as the payload.',
  fields: [
    {
      name: 'messageLength',
      label: 'Message length',
      bits: 32,
      endian: 'le',
      decode: (v) => `${v} bytes total (16-byte header + ${v - 16} bytes body)`,
      note: 'Total message size in bytes, INCLUDING this 16-byte header.',
      desc: 'The total length of this message in bytes, counting the 16-byte msgHeader itself plus the opcode-specific body that follows. A reader uses it to frame one message out of the TCP byte stream — read 4 bytes, then read messageLength-4 more.',
      detail: `MESSAGE LENGTH (int32, little-endian): "the total size of the message in bytes. This total includes the 4 bytes that holds the message length."

FRAMING THE STREAM: MongoDB runs over a raw TCP stream with no record markers, so this self-length is how a peer delimits messages. The canonical read loop is: read exactly 4 bytes to learn messageLength, then read messageLength-4 further bytes to complete the message; repeat. Several messages can be pipelined back-to-back in one TCP segment, so Apex bounds the payload at messageLength (pduBytes) to keep the next message from leaking in.

ENDIANNESS: 32-bit little-endian — wire bytes for a 0x9A (154) byte message are 0x9A 0x00 0x00 0x00. A naive big-endian read would give 0x9A000000, a wildly wrong length, which is exactly why endian:'le' is required here.`,
    },
    {
      name: 'requestID',
      label: 'Request ID',
      bits: 32,
      endian: 'le',
      type: 'uint',
      note: 'Sender-chosen identifier for this message.',
      desc: 'An identifier for this message, chosen by whoever sends it (client or server). It lets a peer correlate replies with requests: a reply echoes this value back in the responseTo field of its own header.',
      detail: `REQUEST ID (int32, little-endian): "a client or database-generated identifier that uniquely identifies this message." It is unique only with respect to the responseTo correlation, not globally.

CORRELATION: when the server answers, it does NOT reuse this number as its own requestID — instead it copies this value into the responseTo field of the reply (see below). The driver matches an in-flight request to its reply by (its requestID == reply.responseTo). This is how an asynchronous driver can have many requests outstanding on one connection and still route each reply to the right waiter.

ENDIANNESS: 32-bit little-endian, like every integer in the header.`,
    },
    {
      name: 'responseTo',
      label: 'Response to',
      bits: 32,
      endian: 'le',
      type: 'uint',
      decode: (v) => (v === 0 ? '0 (this is an original request, not a reply)' : `reply to requestID ${v}`),
      note: 'The requestID this message replies to; 0 in an original request.',
      desc: 'In a reply, the requestID of the original request being answered, so the client can pair the two. In an original request (one not sent in response to anything), this is 0.',
      detail: `RESPONSE TO (int32, little-endian): "in the case of a reply this is set to the requestID taken from the request. Otherwise it is set to 0."

REQUEST vs REPLY: this single field tells you the direction/role of a message without inspecting the opcode. responseTo == 0 => an original request (client -> server, or an unsolicited server message); responseTo == N => this is the server's reply to the message whose requestID was N. A driver keys its pending-request table on this value.

ENDIANNESS: 32-bit little-endian.`,
    },
    {
      name: 'opCode',
      label: 'Op code',
      bits: 32,
      endian: 'le',
      type: 'enum',
      enumMap: OPCODE,
      note: 'Message type. 2013 = OP_MSG (the modern request/reply format).',
      desc: 'The operation code identifying the message type, which determines how the bytes after this header are interpreted. Modern MongoDB uses OP_MSG (2013) for essentially all traffic and OP_COMPRESSED (2012) to wrap a compressed body; the older OP_QUERY/OP_REPLY family is deprecated.',
      detail: `OP CODE (int32, little-endian). Values:
1    OP_REPLY        legacy reply to OP_QUERY/OP_GET_MORE (removed in 5.1)
1000 OP_MSG (legacy) the original generic message opcode (obsolete)
2001 OP_UPDATE       deprecated (removed in 5.1)
2002 OP_INSERT       deprecated (removed in 5.1)
2004 OP_QUERY        deprecated; still used for the hello/isMaster handshake
2005 OP_GET_MORE     deprecated (removed in 5.1)
2006 OP_DELETE       deprecated (removed in 5.1)
2007 OP_KILL_CURSORS deprecated (removed in 5.1)
2012 OP_COMPRESSED   wraps another opcode's body, compressed (snappy/zlib/zstd)
2013 OP_MSG          the modern, extensible request/reply opcode

OP_MSG BODY (what follows this header): a 4-byte little-endian flagBits word, then one or more "sections". A section is a 1-byte kind: kind 0 ("body") is a single BSON document containing the command (e.g. {find:"coll", filter:{...}, $db:"test"}); kind 1 ("document sequence") is a length-prefixed, named run of BSON documents for bulk payloads. An optional 4-byte CRC-32C checksum trails the message when the checksumPresent flag is set.

WHY DISSECTION STOPS HERE: the body is BSON — a length-prefixed, type-tagged binary document format — not a fixed bit grid, so it cannot be transcribed honestly as fixed-offset Fields; it appears in node.payload. ENDIANNESS: wire bytes 0xDD 0x07 0x00 0x00 read little-endian = 0x000007DD = 2013 = OP_MSG.`,
    },
  ],
  // The msgHeader is a fixed 16 bytes.
  headerBytes: (): number => 16,
  // messageLength counts the whole message (header + body), so it bounds the PDU:
  // this keeps a following pipelined message in the same TCP segment from leaking
  // into this message's payload.
  pduBytes: (h: ParsedHeader): number => h.get('messageLength'),
  // What follows is the opcode-specific body (OP_MSG flags + BSON sections). BSON
  // is not a fixed bit grid and there is no generic child protocol to dissect, so
  // dissection stops at the header and the body falls through as node.payload.
  next: (): string | null => null,
};
