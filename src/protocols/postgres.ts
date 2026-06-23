// PostgreSQL Frontend/Backend Protocol, version 3.0.
//
// AUTHORITATIVE REFERENCE
// -----------------------
// PostgreSQL is not an IETF protocol; its wire format is defined by the
// PostgreSQL project's own documentation, "Frontend/Backend Protocol"
// (https://www.postgresql.org/docs/current/protocol.html), with the per-message
// layouts in "Message Formats"
// (https://www.postgresql.org/docs/current/protocol-message-formats.html). The
// header layout below is transcribed from "Overview"
// (https://www.postgresql.org/docs/current/protocol-overview.html). The protocol
// runs over TCP, by convention on port 5432, and is big-endian (network order):
// "The first byte of a message identifies the message type, and the next four
//  bytes specify the length of the rest of the message (this length count
//  includes itself, but not the message-type byte)."
//
// THE COMMON 5-BYTE MESSAGE HEADER
// --------------------------------
// After the startup phase, every PostgreSQL message — in both directions — has
// the same fixed 5-byte framing prefix, which is what this spec models:
//
//   Byte1   messageType   a single ASCII letter identifying the message ('Q',
//                         'R', 'D', …). Shown here as hex because it is a byte
//                         code, with an enumMap mapping the byte to its meaning.
//   Int32   length        the length, in bytes, of the rest of the message —
//                         i.e. these 4 length bytes PLUS the body, but NOT the
//                         1-byte type. So the whole message on the wire is
//                         1 + length bytes (see pduBytes).
//
// The body that follows the header is message-specific (a Query carries a
// null-terminated SQL string; a DataRow carries a column count then per-column
// length+value pairs; an ErrorResponse carries typed field lines; etc.). Those
// bodies are NOT a fixed bit grid, so they cannot be transcribed honestly as
// Field entries — they fall through as node.payload (see the header note and
// next: null). The byte view still shows the real body bytes (e.g. the ASCII
// "SELECT 1;\0" of a Query).
//
// OUT OF SCOPE: the very first message a client sends is the StartupMessage
// (also CancelRequest / SSLRequest / GSSENCRequest), which UNIQUELY has NO type
// byte — it begins directly with the Int32 length. This spec models the regular
// typed messages used for the entire rest of the session; the type-less startup
// messages are noted but not dissected here (a type-less leading Int32 would be
// misread as a phantom type byte + length).
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// Message-type byte -> message name. The byte value is the ASCII code of the
// letter shown in parentheses (e.g. 0x51 = 'Q'). Several letters are reused with
// different meanings depending on direction (frontend F vs backend B); the names
// below are the common/primary ones. (PostgreSQL "Message Formats".)
const MESSAGE_TYPE: Record<number, string> = {
  0x51: "Query ('Q')",              // F: simple query — a SQL command string
  0x52: "Authentication ('R')",     // B: an authentication request/response
  0x53: "ParameterStatus ('S')",    // B: a run-time parameter name/value (also F ParameterDescription is 't')
  0x5a: "ReadyForQuery ('Z')",      // B: backend is idle and ready; carries txn status
  0x54: "RowDescription ('T')",     // B: describes the columns of a result set
  0x44: "DataRow ('D')",            // B: one row of a result (also F Describe is 'D')
  0x43: "CommandComplete ('C')",    // B: a command finished; carries a command tag (also F Close is 'C')
  0x58: "Terminate ('X')",          // F: graceful connection shutdown (body is empty)
  0x45: "ErrorResponse ('E')",      // B: an error occurred; carries typed fields (also F Execute is 'E')
};

export const postgres: ProtocolSpec = {
  id: 'postgres',
  name: 'PostgreSQL v3',
  layer: 7,
  summary:
    "The PostgreSQL v3 Frontend/Backend wire protocol over TCP/5432. After startup, every message — both directions — shares a fixed 5-byte header: a 1-byte ASCII message-type code ('Q' Query, 'D' DataRow, 'E' ErrorResponse, …) followed by a big-endian Int32 length. Crucially the length counts itself and the body but NOT the type byte, so the whole message is 1 + length bytes; the message-specific body falls through as payload.",
  fields: [
    {
      name: 'messageType',
      label: 'Message type',
      bits: 8,
      type: 'enum',
      enumMap: MESSAGE_TYPE,
      decode: (v) => {
        const name = MESSAGE_TYPE[v];
        const ch = v >= 0x20 && v < 0x7f ? String.fromCharCode(v) : '?';
        return `${name ?? 'unknown'}  [0x${v.toString(16).toUpperCase().padStart(2, '0')} = '${ch}']`;
      },
      note: "A single ASCII letter naming the message: 'Q' Query, 'R' Auth, 'D' DataRow, 'Z' ReadyForQuery, 'E' Error…",
      desc: "The first byte of every (post-startup) PostgreSQL message: a single ASCII letter that names the message type. For example 0x51 is 'Q' (Query, a simple SQL command), 0x44 is 'D' (DataRow, one row of a result), 0x5A is 'Z' (ReadyForQuery). This byte is NOT counted in the length field that follows it.",
      detail: `MESSAGE TYPE (1 byte, PostgreSQL "Overview"): identifies the message. It is a printable ASCII letter, so captures are human-readable — you can literally see 'Q', 'T', 'D', 'C', 'Z' walk past in a query round-trip.

Common type codes (byte = ASCII letter):
  0x51 'Q' Query            — frontend: a simple SQL command string.
  0x52 'R' Authentication   — backend: AuthenticationOk / MD5 / SASL / etc. (an Int32 sub-code follows).
  0x53 'S' ParameterStatus  — backend: a run-time GUC name + value (e.g. server_encoding = UTF8).
  0x5A 'Z' ReadyForQuery    — backend: idle and ready for the next query; body is one txn-status byte.
  0x54 'T' RowDescription   — backend: the column metadata for a result set.
  0x44 'D' DataRow          — backend: one row of result data.
  0x43 'C' CommandComplete  — backend: a command finished; body is a tag like "SELECT 1".
  0x58 'X' Terminate        — frontend: close the connection cleanly (length 4, empty body).
  0x45 'E' ErrorResponse    — backend: an error; body is typed field lines (severity, code, message…).

DIRECTIONALITY / REUSE: some letters mean different things by direction — frontend 'D' is Describe, backend 'D' is DataRow; frontend 'C' is Close, backend 'C' is CommandComplete; frontend 'E' is Execute, backend 'E' is ErrorResponse. A parser disambiguates by knowing which peer sent the byte. The enum here lists the common/primary meaning of each code.

ASCII, not arbitrary: because the codes are letters, this field is shown with its hex value AND the decoded letter so the mapping is visible.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 32,
      decode: (v) => `${v} bytes (= 4 length bytes + ${v - 4} body bytes; total message = ${v + 1} bytes incl. type)`,
      note: 'Big-endian Int32. Length of the REST of the message — counts itself but NOT the type byte. Whole message = 1 + length.',
      desc: 'A big-endian 32-bit integer giving the length, in bytes, of the rest of the message: these 4 length bytes plus the message body. It explicitly does NOT include the preceding 1-byte message type. So the body is (length − 4) bytes and the entire message on the wire is (1 + length) bytes. For a Query of "SELECT 1;\\0" the length is 14 (4 + 10), and the full message is 15 bytes.',
      detail: `LENGTH (4 bytes, big-endian Int32, PostgreSQL "Overview"): "the next four bytes specify the length of the rest of the message (this length count includes itself, but not the message-type byte)."

THE OFF-BY-ONE THAT TRIPS EVERYONE: the type byte is OUTSIDE the count, the length field is INSIDE it. So:
  body length      = length − 4
  whole message    = length + 1   (the +1 is the type byte) -> this is pduBytes.
A fixed-size message advertises its constant length, e.g.:
  ReadyForQuery 'Z' : length = 5 (4 + a 1-byte transaction status), whole message 6 bytes.
  Terminate     'X' : length = 4 (4 + empty body),                 whole message 5 bytes.

WHY SELF-INCLUSIVE: a receiver reads the 1 type byte, then the 4 length bytes, then needs to know how many MORE bytes to read; "length − 4" gives exactly that, and a single message can be framed out of a TCP byte stream without any delimiter. Multiple messages are simply concatenated, each self-describing its length.

ENDIANNESS: big-endian (network order), like the rest of PostgreSQL's binary fields — wire bytes 0x00 0x00 0x00 0x0E = 14.`,
    },
  ],
  // Fixed 5-byte framing header: 1-byte type + 4-byte length.
  headerBytes: (): number => 5,
  // The length field counts itself + body but NOT the 1-byte type, so the whole
  // message (and thus the payload boundary) is 1 + length bytes. This keeps the
  // next concatenated message (PostgreSQL streams messages back-to-back over one
  // TCP connection) from leaking into this message's payload.
  pduBytes: (header: ParsedHeader): number => 1 + header.get('length'),
  // The body is message-specific (a SQL string, a row, typed error fields, …),
  // not a fixed bit grid and not a further generic protocol, so dissection stops
  // here and the body bytes fall through as node.payload.
  next: (): string | null => null,
};
