// SMTP — Simple Mail Transfer Protocol.
// RFC 5321 (SMTP; obsoletes RFC 2821, which obsoleted RFC 821). SMTP runs over
// TCP, by convention on port 25 (server-to-server relay / message submission to
// an MX). Related: RFC 6409 (message submission on port 587), RFC 3207
// (STARTTLS), RFC 1869 (SMTP service extensions / the EHLO mechanism).
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Like HTTP (see http.ts), SMTP is a TEXT, line-oriented protocol — not a binary
// header at fixed bit offsets. The dialogue is a stream of US-ASCII lines, each
// terminated by CRLF (\r\n), exchanged in lock-step between a client (the SMTP
// "sender") and a server (the "receiver"). There is no field at "bit offset N for
// K bits", so modelling it as a Field[] would be a lie about the wire. We model
// it truthfully: fields: [], headerBytes: () => 0, so the ENTIRE TCP payload
// falls through as node.payload — the real ASCII line(s) — and no `next`, because
// the message content (after DATA) is application data, not a further protocol.
//
// THE TWO LINE SHAPES (RFC 5321 §4.1, §4.2)
// -----------------------------------------
//   Command line (client -> server):   verb [ SP arguments ] CRLF
//     e.g.  EHLO relay.example.com\r\n
//           MAIL FROM:<alice@example.com>\r\n
//           RCPT TO:<bob@example.net>\r\n
//           DATA\r\n
//           QUIT\r\n
//   The verb is 4 characters for the standard commands and is case-insensitive
//   (§2.4); mailbox local-parts, however, are case-sensitive.
//
//   Reply line (server -> client):     code (SP|"-") text CRLF
//     e.g.  220 mx.example.net ESMTP ready\r\n
//           250-mx.example.net at your service\r\n   <- "-" = more lines follow
//           250 SIZE 35882577\r\n                     <- SP on the last line
//           354 Start mail input; end with <CRLF>.<CRLF>\r\n
//           221 Bye\r\n
//   The reply code is exactly three digits (§4.2). The 4th character is a SPACE
//   on the final line of a reply and a HYPHEN ("-") on every continuation line of
//   a multiline reply (§4.2.1) — that is how the client knows the reply is done.
//
// REPLY CODE THEORY (RFC 5321 §4.2.1, §4.2.3)
//   First digit  — outcome:   2 = success/completed, 3 = intermediate (more
//                  input needed, e.g. DATA), 4 = transient failure (try again
//                  later), 5 = permanent failure.
//   Second digit — category:  0 = syntax, 1 = information, 2 = connections,
//                  5 = mail system.
//   Common codes: 220 service ready, 221 closing channel, 250 OK,
//                  354 start mail input, 421 service not available,
//                  450/451/452 transient mailbox/system errors,
//                  500/501/502/503 syntax / not-implemented / bad sequence,
//                  550 mailbox unavailable, 552 storage exceeded, 554 failed.
//
// A TYPICAL TRANSACTION (RFC 5321 §3.3)
//   S: 220 mx.example.net ESMTP ready
//   C: EHLO relay.example.com
//   S: 250-mx.example.net / 250 ... (capability list)
//   C: MAIL FROM:<alice@example.com>      S: 250 OK
//   C: RCPT TO:<bob@example.net>          S: 250 OK
//   C: DATA                                S: 354 Start mail input
//   C: <headers + body>                    C: .         (a lone "." ends the data)
//                                          S: 250 OK queued
//   C: QUIT                                S: 221 Bye
//
// THE END-OF-DATA MARKER (RFC 5321 §4.1.1.4): after DATA, the message body is
// sent verbatim and terminated by the five-byte sequence CRLF "." CRLF
// (0D 0A 2E 0D 0A). A line of the body that itself begins with "." is sent as
// ".." — "dot-stuffing" — so it cannot be mistaken for the terminator.
//
// We do not parse the verb, code, or arguments into fields (they are variable
// text); the byte view shows the raw ASCII so a reader sees, e.g., 0x45 0x48 0x4C
// 0x4F = "EHLO" directly. The teaching lives in this comment and the summary.
import type { ProtocolSpec } from '../core/types';

export const smtp: ProtocolSpec = {
  id: 'smtp',
  name: 'SMTP',
  layer: 7,
  summary:
    'A TEXT, line-based mail-transfer protocol over TCP/25. The client sends commands (EHLO, MAIL FROM, RCPT TO, DATA, QUIT) and the server answers with lines that begin with a 3-digit reply code (220 ready, 250 OK, 354 start input, 221 bye). Every line ends in CRLF; in a multiline reply the 4th character is "-" on continuation lines and a SPACE on the last. Like HTTP, SMTP has no fixed bit-fields — it is framed by \\r\\n, so Apex shows the raw ASCII rather than a byte grid.',
  // Intentionally empty: SMTP has no fixed binary header. See the top-of-file
  // comment. With headerBytes() => 0 the whole TCP segment becomes the payload,
  // exposing the real ASCII command/reply bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire segment is the line text.
  headerBytes: () => 0,
  // After DATA the body is the (opaque) message content — not a further protocol
  // to dissect generically — so dissection stops here.
};
