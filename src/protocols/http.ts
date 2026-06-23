// HTTP/1.1 — Hypertext Transfer Protocol, message syntax and routing.
// RFC 9112 (HTTP/1.1 message format; obsoletes RFC 7230) — and the semantics
// layered on it by RFC 9110 (HTTP Semantics). HTTP/1.1 runs over TCP, by
// convention on port 80 (cleartext) or inside TLS on port 443 (HTTPS).
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Every other protocol in Apex (Ethernet, IPv4, TCP) is a BINARY protocol: its
// header is a fixed grid of bits at known offsets, so we can transcribe it as a
// list of `Field`s with exact bit widths. HTTP/1.1 is fundamentally different —
// it is a TEXT, line-oriented protocol. A message is a sequence of US-ASCII
// characters delimited by CRLF (\r\n), not by bit positions:
//
//   request-line   = method SP request-target SP HTTP-version CRLF   (RFC 9112 §3)
//   *( field-line CRLF )                                             (RFC 9112 §5)
//   CRLF                          <- the empty line ends the headers
//   [ message-body ]                                                 (RFC 9112 §6)
//
//   (a response replaces the request-line with a status-line:
//    HTTP-version SP status-code SP [ reason-phrase ] CRLF           RFC 9112 §4)
//
// There is no field that lives "at bit offset N for K bits": a header could be
// at byte 17 in one request and byte 200 in another, and field NAMES are
// arbitrary tokens (Host, User-Agent, X-Whatever). You parse it by scanning for
// CRLF and the ":" separator, not by reading fixed-width integers. That cannot
// be modelled honestly as a `Field[]`, and inventing fixed offsets would be a
// lie about the wire. So we model HTTP truthfully:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE TCP segment falls through as the payload,
//                             which IS the ASCII message text. The byte view
//                             then shows the real bytes (0x47 0x45 0x54 = "GET")
//                             and a reader can see the text framing directly.
//   * no `next`             — the body is application data (HTML, JSON, an image,
//                             a chunked stream…); there is no further protocol to
//                             dissect generically, so dissection stops here.
//
// MESSAGE FRAMING (RFC 9112 §6) — how a receiver knows where a message ends:
//   1. Responses to HEAD, and 1xx/204/304 responses, have no body.
//   2. Transfer-Encoding: chunked frames the body as size-prefixed chunks and
//      overrides Content-Length.
//   3. Otherwise Content-Length gives the exact body length in bytes.
//   4. For a response with neither, the body runs until the server closes the
//      connection.
// We do not implement these length rules here (the body bytes are simply the
// payload); they are documented so the teaching is complete.
import type { ProtocolSpec } from '../core/types';

export const http: ProtocolSpec = {
  id: 'http',
  name: 'HTTP/1.1',
  layer: 7,
  summary:
    'A TEXT, line-based application protocol over TCP/80. A message is ASCII: a request-line (or status-line), header field-lines each ended by CRLF, a blank CRLF, then an optional body. Unlike the binary headers below it, HTTP has no fixed bit-fields — it is framed by \\r\\n and ":", so Apex shows the raw message text rather than a byte grid.',
  // Intentionally empty: HTTP/1.1 has no fixed binary header. See the top-of-file
  // comment. With headerBytes() => 0 the whole TCP segment becomes the payload,
  // exposing the real ASCII message bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire segment is the message text.
  headerBytes: () => 0,
  // The body is opaque application data (HTML/JSON/binary/chunked) with no
  // generic child protocol to dissect, so we stop here.
};
