// IMAP4rev1 — Internet Message Access Protocol, version 4rev1.
// RFC 3501 (IMAP4rev1; obsoletes RFC 2060). IMAP runs over TCP, by convention
// on port 143 (cleartext) or inside TLS on port 993 (IMAPS). It lets a client
// read and manage mail that REMAINS on the server (unlike POP3, which downloads
// and typically deletes).
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Ethernet, IPv4, TCP and UDP are BINARY protocols: each header is a fixed grid
// of bits at known offsets, so we transcribe it as a list of `Field`s with exact
// bit widths. IMAP is fundamentally different — like HTTP, it is a TEXT,
// line-oriented protocol. Every interaction is a line of US-ASCII characters
// ended by CRLF (\r\n), not a sequence of fixed-width integers (RFC 3501 §2.2):
//
//   "All interactions transmitted by client and server are in the form of
//    lines, that is, strings that end with a CRLF."
//
// THE THREE LINE SHAPES (RFC 3501 §2.2.1, §2.2.2, §7)
// ---------------------------------------------------
//   1. Client command — tag SP command [SP arguments] CRLF
//        a001 LOGIN bob secret\r\n
//      The TAG (e.g. "a001") is a short alphanumeric token the client chooses;
//      the matching tagged response tells the client this command is done.
//      Because IMAP commands may be pipelined, the tag is what pairs a response
//      back to its command.
//
//   2. Server response — two forms:
//        * Untagged response, prefixed with "* " — unsolicited or in-progress
//          data (mailbox state, FETCH results, the greeting):
//            * OK [CAPABILITY IMAP4rev1] server ready\r\n
//            * 3 EXISTS\r\n
//        * Tagged status response — prefixed with the command's own tag, giving
//          the final completion: OK (success), NO (failure), or BAD (protocol
//          error):
//            a001 OK LOGIN completed\r\n
//
//   3. Continuation request — prefixed with "+ " — the server asks the client to
//      send the rest of the command (e.g. a literal or AUTHENTICATE data):
//            + Ready for additional command text\r\n
//
// LITERALS (RFC 3501 §4.3) — the one place IMAP carries arbitrary bytes:
//   {<n>}CRLF introduces an n-OCTET literal; the next n bytes are taken verbatim
//   (they may contain CRLF or NUL). This is why IMAP cannot be parsed by CRLF
//   alone in general — a length-prefixed literal can embed CRLFs. We do not model
//   literals as fields; the whole line(s) fall through as the payload text.
//
// WHY fields: [] AND headerBytes: () => 0
// ---------------------------------------
// There is no field that lives "at bit offset N for K bits": a tag may be 2 or 8
// characters, a command name is an arbitrary keyword, and arguments vary. You
// parse IMAP by scanning for SP and CRLF (and honouring literal lengths), not by
// reading fixed-width integers. Inventing fixed offsets would be a lie about the
// wire. So, exactly like http.ts:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE TCP segment falls through as the payload,
//                             which IS the ASCII line text. The byte view then
//                             shows the real bytes (0x61 0x30 0x30 0x31 = "a001").
//   * no `next`             — the line text is the application data itself; there
//                             is no further protocol to dissect, so we stop here.
import type { ProtocolSpec } from '../core/types';

export const imap: ProtocolSpec = {
  id: 'imap',
  name: 'IMAP4rev1',
  layer: 7,
  summary:
    'A TEXT, line-based mail-access protocol over TCP/143 (or TLS/993). Every interaction is an ASCII line ended by CRLF. Client commands are prefixed with a chosen TAG ("a001 LOGIN bob secret"); the server answers with untagged "* " data lines, a final tagged status line ("a001 OK/NO/BAD ..."), or a "+ " continuation request. Unlike the binary headers below it, IMAP has no fixed bit-fields, so Apex shows the raw line text rather than a byte grid.',
  // Intentionally empty: IMAP4rev1 has no fixed binary header. See the
  // top-of-file comment. With headerBytes() => 0 the whole TCP segment becomes
  // the payload, exposing the real ASCII line bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire segment is the line text.
  headerBytes: () => 0,
  // The line text is the application data; there is no generic child protocol to
  // dissect, so dissection stops here.
};
