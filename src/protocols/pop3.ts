// POP3 — Post Office Protocol Version 3.
// RFC 1939 (STD 53) — the base protocol. Extension mechanism: RFC 2449 (CAPA).
// Authentication extensions: RFC 1734 (APOP is in RFC 1939 itself), RFC 5034
// (SASL AUTH). STARTTLS upgrade: RFC 2595. POP3 runs over TCP, by convention on
// port 110 (cleartext) or inside TLS on port 995 (POP3S).
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Like HTTP, POP3 is a TEXT, line-oriented protocol — not a binary header at
// fixed bit offsets. The session is a dialogue of US-ASCII lines, each ended by
// CRLF (\r\n), so there is no field that lives "at bit N for K bits". Modelling
// it as a Field[] with fixed widths would be a lie about the wire. We therefore
// follow the same honest pattern as src/protocols/http.ts:
//
//   * fields: []            — no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE TCP payload falls through as node.payload,
//                             which IS the ASCII line(s). The byte view then
//                             shows the real bytes (0x2B 0x4F 0x4B = "+OK").
//   * no `next`             — message bodies are RFC 5322 mail / MIME, opaque to
//                             POP3; dissection stops here.
//
// THE PROTOCOL GRAMMAR (RFC 1939 §3, §4)
// --------------------------------------
// COMMANDS (client -> server): a keyword, optional SP-separated arguments, CRLF.
//   Keyword is 3-4 chars, case-insensitive. RFC 1939 §3 caps a server RESPONSE
//   status line at 512 octets (incl. CRLF); command arguments are <= 40 octets.
//     command = keyword [ SP argument ] CRLF        (e.g. "RETR 1\r\n")
//
// RESPONSES (server -> client): a status indicator then optional text, CRLF.
//   Exactly two status indicators (RFC 1939 §3):
//     "+OK"  — positive (success)
//     "-ERR" — negative (failure)
//   status-line = ( "+OK" / "-ERR" ) [ SP text ] CRLF
//
// SESSION STATES (RFC 1939 §3): after the TCP connect the server sends a "+OK"
// greeting and enters AUTHORIZATION (USER/PASS or APOP). On success it enters
// TRANSACTION (STAT, LIST, RETR, DELE, NOOP, RSET, TOP, UIDL). QUIT moves to
// UPDATE, where deletions are committed and the connection closes.
//
// MULTI-LINE RESPONSES & BYTE-STUFFING (RFC 1939 §3): responses to RETR, TOP,
// and the no-argument forms of LIST/UIDL are multi-line. They end with a line
// containing a single period: the terminator is the five octets CRLF "." CRLF.
// To keep that terminator unambiguous, any body line that itself begins with a
// "." is byte-stuffed with an extra leading "." by the sender, which the
// receiver strips. We do not parse the dialogue here (the bytes are simply the
// payload); the grammar is documented so the teaching is complete.
import type { ProtocolSpec } from '../core/types';

export const pop3: ProtocolSpec = {
  id: 'pop3',
  name: 'POP3',
  layer: 7,
  summary:
    'A TEXT, line-based mail-retrieval protocol over TCP/110 (RFC 1939). The client sends commands ("USER bob", "RETR 1") and the server replies with a status line beginning "+OK" or "-ERR", each ended by CRLF. Multi-line replies (RETR/TOP/LIST) end with a "." on its own line. Like HTTP, POP3 has no binary header, so Apex shows the raw ASCII line bytes rather than a bit grid.',
  // Intentionally empty: POP3 is text-framed by CRLF, not by fixed offsets. See
  // the top-of-file comment. With headerBytes() => 0 the whole TCP payload
  // becomes node.payload, exposing the real ASCII bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire segment is the line text.
  headerBytes: () => 0,
  // Message bodies are RFC 5322 / MIME mail, opaque to POP3 — stop here.
};
