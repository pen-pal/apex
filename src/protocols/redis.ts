// Redis Serialization Protocol (RESP) — the wire protocol of Redis.
// Authoritative spec: https://redis.io/docs/latest/develop/reference/protocol-spec/
// (RESP2 and RESP3). RESP runs over TCP, by convention on port 6379.
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Like HTTP, RESP is a TEXT, line-oriented protocol — NOT a fixed binary header
// at known bit offsets. Every RESP value is a sequence of US-ASCII characters in
// which the FIRST BYTE is a type marker and parts are always separated by CRLF
// (\r\n). There is no field that lives "at bit offset N for K bits": the length
// and number of elements vary per message, so it cannot be modelled honestly as
// a Field[]. Inventing fixed offsets would be a lie about the wire. So, exactly
// like http.ts, we model RESP truthfully:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE TCP segment falls through as the payload,
//                             which IS the ASCII RESP text. The byte view then
//                             shows the real bytes (0x2a = '*', 0x24 = '$') and a
//                             reader can see the CRLF framing directly.
//   * no `next`             — RESP is the application layer; there is no further
//                             protocol to dissect generically, so we stop here.
//
// THE TYPE BYTES (first byte of every value)
// ------------------------------------------
// RESP2:
//   '+' (0x2b) Simple string   e.g.  +OK\r\n
//   '-' (0x2d) Simple error     e.g.  -ERR unknown command\r\n
//   ':' (0x3a) Integer          e.g.  :1000\r\n
//   '$' (0x24) Bulk string      e.g.  $5\r\nhello\r\n   ($-1\r\n is the null bulk string)
//   '*' (0x2a) Array            e.g.  *2\r\n...\r\n      (*-1\r\n is the null array)
// RESP3 adds: '_' null, '#' boolean, ',' double, '(' big number, '!' bulk error,
//   '=' verbatim string, '%' map, '~' set, '>' push, '|' attribute.
//
// HOW A COMMAND IS FRAMED
// -----------------------
// A client sends every command as an ARRAY OF BULK STRINGS — the command name and
// each argument is its own bulk string. For example, `GET foo` goes on the wire as:
//
//   *2\r\n$3\r\nGET\r\n$3\r\nfoo\r\n
//      |    |       |     |       +-- bulk string "foo" (3 bytes), CRLF-terminated
//      |    |       |     +-- "$3\r\n" = next bulk string is 3 bytes long
//      |    |       +-- "GET" (3 bytes), CRLF-terminated
//      |    +-- "$3\r\n" = first bulk string is 3 bytes long
//      +-- "*2\r\n" = array of 2 elements follows
//
// The server replies with a single RESP value of the appropriate type (e.g.
// `$3\r\nbar\r\n` for the stored value, `:1000\r\n` for a counter, `+OK\r\n` for
// a status, or `-ERR ...\r\n` for an error). We do not parse the type/length
// fields here (they are not fixed-offset); they are documented so the teaching is
// complete, and the raw bytes are shown so the framing is visible.
import type { ProtocolSpec } from '../core/types';

export const redis: ProtocolSpec = {
  id: 'redis',
  name: 'Redis (RESP)',
  layer: 7,
  summary:
    'A TEXT, line-based application protocol over TCP/6379. Each value begins with a one-byte TYPE marker — "+" simple string, "-" error, ":" integer, "$" bulk string, "*" array — and every part is CRLF-terminated. A client sends a command as an array of bulk strings, e.g. "*2\\r\\n$3\\r\\nGET\\r\\n$3\\r\\nfoo\\r\\n". Like HTTP, RESP has no fixed bit-fields, so Apex shows the raw message text rather than a byte grid.',
  // Intentionally empty: RESP has no fixed binary header. See the top-of-file
  // comment. With headerBytes() => 0 the whole TCP segment becomes the payload,
  // exposing the real ASCII RESP bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire segment is the RESP message text.
  headerBytes: () => 0,
  // RESP is the application layer; there is no generic child protocol to dissect,
  // so we stop here.
};
