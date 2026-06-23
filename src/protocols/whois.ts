// WHOIS — RFC 3912 (WHOIS Protocol Specification, obsoletes RFC 954/812).
// WHOIS is a TCP/IP transaction-based query/response protocol, by convention on
// TCP port 43. It is used to look up registration records for domains, IP
// address allocations, autonomous-system numbers, and similar registry objects.
//
// THE WHOLE PROTOCOL (RFC 3912 §2 "Protocol Specification")
// ---------------------------------------------------------
// It is about as small as a network protocol gets:
//
//   1. The client connects to the server's TCP port 43.
//   2. When the connection is accepted, the client sends ONE query — a single
//      line of text — terminated by ASCII CR followed by ASCII LF:
//
//          "All requests are terminated with ASCII CR and then ASCII LF."
//
//      e.g.  example.com\r\n   (look up the domain example.com)
//
//   3. The server sends back the response, which is free-form text and may span
//      many lines. CR/LF inside the response do NOT delimit it:
//
//          "The response might contain more than one line of text, so the
//           presence of ASCII CR or ASCII LF characters does not indicate the
//           end of the response."
//
//   4. The server CLOSES the TCP connection once the output is finished. The
//      closed connection — not any in-band marker — is what tells the client the
//      response is complete:
//
//          "The WHOIS server closes its connection as soon as the output is
//           finished. The closed TCP connection is the indication to the client
//           that the response has been received."
//
// There is no version negotiation, no status code, no content-length, no
// authentication, and (RFC 3912 §3.1) no defined character set — historically
// US-ASCII, though servers outside the USA may use other encodings.
//
// WHY THIS SPEC HAS NO BIT-FIELDS (same reasoning as http.ts)
// ----------------------------------------------------------
// WHOIS is a TEXT protocol. The query is a line of ASCII delimited by CRLF, and
// the reply is unstructured text delimited only by the TCP connection closing.
// Nothing lives "at bit offset N for K bits", so there is no honest `Field[]` to
// transcribe. Modelling it like the binary protocols would mean inventing
// offsets that do not exist on the wire. So, exactly like HTTP/1.1, we model it
// truthfully:
//
//   * fields: []            — no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE TCP segment falls through as the payload,
//                             which IS the ASCII query/response text. The byte
//                             view then shows the real bytes (0x65 0x78 0x61 =
//                             "exa…") and a reader sees the text framing directly.
//   * no `next`             — the reply is opaque application text; there is no
//                             further protocol to dissect, so we stop here.
import type { ProtocolSpec } from '../core/types';

export const whois: ProtocolSpec = {
  id: 'whois',
  name: 'WHOIS',
  layer: 7,
  summary:
    'The simplest TEXT application protocol over TCP/43 (RFC 3912). The client sends ONE query line — e.g. "example.com" — terminated by CR LF, and the server streams back a free-form text record. There is no header, no status code, and no length field: the response ends when the server CLOSES the TCP connection. Apex shows the raw ASCII query bytes rather than a byte grid.',
  // Intentionally empty: WHOIS has no fixed binary header. See the top-of-file
  // comment. With headerBytes() => 0 the whole TCP segment becomes the payload,
  // exposing the real ASCII query/response bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire segment is the message text.
  headerBytes: () => 0,
  // The reply is opaque application text (and ends only when the connection
  // closes) — there is no generic child protocol to dissect, so we stop here.
};
