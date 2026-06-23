// MySQL Client/Server Protocol — the packet header.
// Reference: the MySQL Internals / Source documentation, "MySQL Client/Server
// Protocol", section "Basic Packets" (dev.mysql.com/doc/dev/mysql-server/latest/
// page_protocol_basic_packets.html). MySQL is not an IETF protocol — its
// authoritative reference is Oracle's MySQL protocol documentation; the field
// widths, endianness, and semantics below are transcribed from it (current as of
// 2026). MySQL runs over TCP, by convention on port 3306.
//
// THE PACKET HEADER (4 bytes)
// ---------------------------
// Every message in the MySQL protocol — a handshake, a command, a result row, an
// OK/ERR packet — is framed by the same fixed 4-byte header:
//
//   +-----------------------------------+------------------+
//   | payload_length  (int<3>, 3 bytes) | seq_id (int<1>)  |
//   +-----------------------------------+------------------+
//   |              the payload (payload_length bytes)      |
//   +-----------------------------------------------------+
//
//   payload_length : the number of bytes in the payload that FOLLOWS this header
//                    (it does NOT include these 4 header bytes).
//   sequence_id    : a packet-ordering counter. It is reset to 0 at the start of
//                    each command in the Command Phase and increments by 1 for
//                    every packet exchanged within that command/response.
//
// ENDIANNESS
// ----------
// Like SMB2, MySQL is a LITTLE-ENDIAN wire protocol: all of its fixed-width
// integers (including this 3-byte length) are stored least-significant byte
// first. The engine's generic `endian: 'le'` field hook reads the true value
// directly (wire bytes 0x21 0x00 0x00 -> 33). The 1-byte sequence_id is
// endianness-neutral.
//
// WHY ONLY THE HEADER
// -------------------
// This spec models the fixed 4-byte framing header only. The payload that follows
// is not a single fixed bit grid — it is one of many message types whose shape
// depends on the protocol phase and the preceding command. For example, in the
// Command Phase a COM_QUERY is a 1-byte command tag 0x03 followed by the SQL
// statement as raw (typically UTF-8) text; an OK packet begins 0x00; an ERR
// packet begins 0xFF; the initial server greeting is a HandshakeV10. None of
// these can be transcribed honestly as a single Field grid, so the payload falls
// through as node.payload (see the header `note` and `next: () => null`). The
// byte view then shows the real payload bytes — e.g. the 0x03 command tag and the
// ASCII SQL text after it.
//
// LARGE PACKETS: if a payload reaches 2^24 - 1 (16,777,215) bytes, payload_length
// is set to 0xFFFFFF and the payload is split across multiple packets until one
// carries fewer than 2^24 - 1 bytes; reassembly is a transport concern above this
// single-header model.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

export const mysql: ProtocolSpec = {
  id: 'mysql',
  name: 'MySQL',
  layer: 7,
  summary:
    'The MySQL Client/Server protocol over TCP/3306. Every message — handshake, command, or result — is framed by a fixed 4-byte header: a 3-byte LITTLE-ENDIAN payload length (excluding the header) and a 1-byte sequence id that resets to 0 per command. The payload (e.g. a COM_QUERY 0x03 + SQL text) falls through as bytes.',
  fields: [
    {
      name: 'payloadLength',
      label: 'Payload length',
      bits: 24,
      endian: 'le',
      decode: (v) => `${v} byte${v === 1 ? '' : 's'} of payload follow this header`,
      note: '3-byte little-endian length of the payload that follows (NOT incl. this 4-byte header).',
      desc: 'The length, in bytes, of the payload that follows this 4-byte header. It does NOT include the header itself. It is a 3-byte (24-bit) little-endian integer, so a single MySQL packet payload can be up to 2^24 - 1 = 16,777,215 bytes; larger payloads are split across multiple packets.',
      detail: `PAYLOAD LENGTH (int<3>, 3 bytes, little-endian, MySQL "Basic Packets"): the number of bytes in the payload that follows this header. It counts ONLY the payload — the 4 header bytes are excluded.

ENDIANNESS DEMO: wire bytes 0x21 0x00 0x00 read little-endian are 0x000021 = 33 (a naive big-endian read would give 0x210000 = 2,162,688). The least-significant byte is first.

WHY 3 BYTES: a 24-bit length caps one packet's payload at 2^24 - 1 = 16,777,215 bytes. When a payload reaches exactly that maximum, the sender writes 0xFFFFFF here and continues the payload in the next packet (which carries its own header), repeating until a packet holds fewer than 2^24 - 1 bytes — so an empty trailing packet (length 0) is sent if the payload is an exact multiple of 16 MiB. A receiver concatenates these payloads to reconstruct the full message.

This length bounds the PDU: pduBytes() = 4 + payloadLength, so trailing TCP bytes (e.g. a following pipelined packet) do not leak into this payload.`,
    },
    {
      name: 'sequenceId',
      label: 'Sequence ID',
      bits: 8,
      decode: (v) => `${v} (resets to 0 at the start of each command)`,
      note: '1-byte packet counter; resets to 0 per command, increments per packet within a command/response.',
      desc: 'A 1-byte packet-ordering counter. In the Command Phase it is reset to 0 at the start of each command (e.g. a COM_QUERY) and then increments by 1 for every packet exchanged in that command and its response. It lets each side detect lost or out-of-order packets within an exchange.',
      detail: `SEQUENCE ID (int<1>, 1 byte, MySQL "Basic Packets"): a per-exchange packet counter.

LIFECYCLE:
- It is RESET to 0 at the start of each new command in the Command Phase. So the first packet of a client COM_QUERY carries sequence_id 0.
- The server's reply continues the count: the first response packet is sequence_id 1, the next is 2, and so on across a multi-packet result set (column-count packet, column definitions, EOF/row packets, …).
- It WRAPS at 255 -> 0 (it is a single byte) for very long exchanges.
- During the initial connection (the handshake) it likewise starts at 0 on the server's greeting and increments through the handshake response and auth exchange.

A mismatch between the expected and received sequence_id signals a desynchronized stream (the connection is typically dropped). Being one byte, this field is endianness-neutral.`,
    },
  ],
  // Fixed 4-byte framing header.
  headerBytes: (): number => 4,
  // The payload_length field bounds the PDU: header (4) + payload. This keeps any
  // following pipelined packet's bytes out of this packet's payload.
  pduBytes: (h: ParsedHeader): number => 4 + h.get('payloadLength'),
  // The payload is one of many message types (COM_QUERY 0x03 + SQL text, OK 0x00,
  // ERR 0xFF, HandshakeV10, result rows…) and is not a single fixed bit grid, so
  // there is no generic child protocol to dissect — it falls through as
  // node.payload. See the top-of-file note.
  next: (): string | null => null,
};
