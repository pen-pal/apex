// FTP — File Transfer Protocol, control channel.
// RFC 959 (FILE TRANSFER PROTOCOL (FTP)) — the base specification.
// Related: RFC 5797 (the command/reply registry), RFC 2228 (security
// extensions), RFC 2428 (EPSV/EPRT for IPv6), RFC 3659 (extensions: SIZE/MDTM/
// MLSD), RFC 2640 (UTF-8 pathnames). The control channel runs over TCP, by
// convention on the server's port 21.
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Like HTTP (see http.ts), FTP's control channel is a TEXT, line-oriented
// protocol, not a binary header at fixed bit offsets. RFC 959 §4.1.1 calls the
// commands "Telnet strings": the client sends ASCII command lines and the server
// answers with ASCII reply lines, each terminated by the Telnet end-of-line
// CRLF (\r\n = 0x0D 0x0A). There is no field that lives "at bit offset N for K
// bits", so it cannot be modelled honestly as a Field[]. Inventing fixed offsets
// would be a lie about the wire. So, exactly like http.ts, we model FTP
// truthfully:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE TCP segment falls through as the payload,
//                             which IS the ASCII line text. The byte view then
//                             shows the real bytes (0x55 0x53 0x45 0x52 = "USER")
//                             and a reader can see the line framing directly.
//   * no `next`             — a control line is the application data itself; there
//                             is no further protocol to dissect, so we stop here.
//
// COMMAND SYNTAX (RFC 959 §4.1, §5.3)
//   command = command-code [ SP argument ] CRLF
// e.g.  "USER anonymous\r\n",  "RETR file.txt\r\n",  "QUIT\r\n".
// Command codes are 3-4 letter ASCII tokens, case-insensitive per §5.3.
//
// REPLY SYNTAX (RFC 959 §4.2)
//   A reply is a 3-digit code followed by text. Two forms:
//     single-line:  "220 Service ready\r\n"          (code SP text CRLF)
//     multi-line:   "220-First line\r\n              (code "-" begins the block,
//                    ...\r\n                           continuation lines follow,
//                    220 Last line\r\n"                same code SP ends it)
//   The 3 digits are significant (RFC 959 §4.2.1):
//     1st digit — reply category:
//       1yz Positive Preliminary (action started; expect another reply)
//       2yz Positive Completion  (action succeeded)
//       3yz Positive Intermediate(need more info, e.g. password)
//       4yz Transient Negative   (try again later)
//       5yz Permanent Negative   (request failed; do not retry as-is)
//     2nd digit — subject group: x0z syntax, x1z information, x2z connections,
//       x3z authentication/accounting, x5z file system.
//     3rd digit — finer detail within the group.
//   Common codes: 220 ready, 331 need password, 230 logged in, 150 opening data
//   connection, 226 transfer complete, 227 entering passive mode, 500 syntax
//   error, 530 not logged in, 550 file unavailable.
//
// THE DATA CONNECTION (RFC 959 §3.2) is OUT OF SCOPE here. Control (port 21)
// only carries commands/replies; the actual file bytes flow on a SEPARATE TCP
// connection negotiated by PORT/PASV (active/passive). Apex dissects only the
// control line you give it; the file transfer is a different stream.
//
// We do not implement reply-code parsing or multi-line reply assembly here (the
// line bytes are simply the payload); they are documented so the teaching is
// complete.
import type { ProtocolSpec } from '../core/types';

export const ftp: ProtocolSpec = {
  id: 'ftp',
  name: 'FTP (control)',
  layer: 7,
  summary:
    'A TEXT, line-based control protocol over TCP/21. The client sends ASCII command lines ("USER anonymous\\r\\n") and the server answers with ASCII reply lines beginning with a 3-digit code ("220 Service ready\\r\\n"), each terminated by CRLF. Like HTTP it has no fixed bit-fields — it is framed by \\r\\n, so Apex shows the raw line text. (The file bytes travel on a separate data connection negotiated by PORT/PASV, not shown here.)',
  // Intentionally empty: the FTP control channel has no fixed binary header. See
  // the top-of-file comment. With headerBytes() => 0 the whole TCP segment
  // becomes the payload, exposing the real ASCII command/reply bytes in the byte
  // view.
  fields: [],
  // No binary header is consumed, so the entire segment is the line text.
  headerBytes: () => 0,
  // A control line is the application data itself; there is no generic child
  // protocol to dissect, so we stop here.
};
