// Telnet — the Telnet Protocol. RFC 854 (Telnet Protocol Specification) and its
// companion RFC 855 (Telnet Option Specifications). Telnet runs over TCP, by
// convention on port 23. It is the classic remote-terminal protocol: a
// bidirectional, 8-bit-clean byte stream between two endpoints.
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Telnet, like HTTP, is not a binary protocol with a fixed header grid. There is
// no "field at bit offset N for K bits". A Telnet stream is mostly raw NVT text
// (US-ASCII keystrokes and screen output) interleaved, IN-BAND, with command
// sequences. Nothing lives at a predictable offset, so transcribing it as a
// `Field[]` with fixed widths would be a lie about the wire. We model it
// truthfully like http.ts:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a header, so the ENTIRE TCP
//                             segment falls through as node.payload, exposing the
//                             real bytes (text + any 0xFF command sequences) in
//                             the byte view.
//   * no `next`             — Telnet is the top of the stack; the byte stream is
//                             the application data itself, so dissection stops.
//
// THE NVT (NETWORK VIRTUAL TERMINAL) — RFC 854
// --------------------------------------------
// Both ends imagine they are talking to a "Network Virtual Terminal": a
// canonical, network-wide intermediate terminal so neither side needs to know
// the other's real terminal type. The NVT is a printer (output) + keyboard
// (input) handling 7-bit US-ASCII carried in 8-bit bytes. Defined NVT controls
// include CR (13), LF (10); a CR must be followed by either LF (newline) or NUL
// (a bare carriage return), per RFC 854.
//
// IN-BAND COMMANDS: IAC (0xFF) — RFC 854
// --------------------------------------
// Commands are embedded in the same stream as data, introduced by the octet
// IAC = "Interpret As Command" = 255 (0xFF). The byte AFTER IAC is the command:
//
//   IAC   255  0xFF  Interpret As Command — the escape that begins a command.
//   SE    240        End of subnegotiation parameters.
//   NOP   241        No operation.
//   DM    242        Data Mark — the data-stream portion of a Synch (with TCP URG).
//   BRK   243        Break — the BREAK/ATTN key.
//   IP    244        Interrupt Process.
//   AO    245        Abort Output.
//   AYT   246        Are You There.
//   EC    247        Erase Character.
//   EL    248        Erase Line.
//   GA    249        Go Ahead — "your turn" signal in half-duplex.
//   SB    250        Begin subnegotiation of the indicated option.
//
// OPTION NEGOTIATION — the WILL/WON'T/DO/DON'T dance (RFC 854/855):
//   WILL  251  Sender WILL begin / is performing the option.   (offer to enable)
//   WON'T 252  Sender WON'T / refuses to perform the option.    (refusal/disable)
//   DO    253  Sender wants the other side to perform the option.
//   DON'T 254  Sender wants the other side to NOT perform it.
// Each of WILL/WON'T/DO/DON'T is followed by a single OPTION code byte (e.g.
// 1 = ECHO, 3 = SUPPRESS GO AHEAD, 24 = TERMINAL-TYPE, 31 = NAWS — option codes
// are assigned by IANA / individual option RFCs, not RFC 854). A three-byte
// negotiation is therefore: IAC <WILL|WONT|DO|DONT> <option>, e.g.
// FF FB 01 = "IAC WILL ECHO".
//
// IAC ESCAPING: because 0xFF is the command escape, a literal data byte of value
// 255 is sent as IAC IAC (0xFF 0xFF — the IAC is doubled). All other 255 byte
// values pass through transparently. (RFC 854.)
//
// We do NOT split the stream into per-command sub-fields here: a segment can mix
// arbitrary text with any number of variable-length command/subnegotiation
// sequences at unpredictable offsets, which cannot be modelled as fixed Fields.
// The raw bytes are surfaced as the payload; the byte view shows the 0xFF
// markers directly, and this comment + the summary teach how to read them.
import type { ProtocolSpec } from '../core/types';

export const telnet: ProtocolSpec = {
  id: 'telnet',
  name: 'Telnet',
  layer: 7,
  summary:
    'A remote-terminal protocol over TCP/23. The stream is mostly raw NVT (Network Virtual Terminal) US-ASCII text, interleaved IN-BAND with command sequences introduced by IAC = 0xFF (255). Option negotiation uses three-byte sequences IAC <WILL 251 | WON\'T 252 | DO 253 | DON\'T 254> <option>; a literal 0xFF in data is escaped as IAC IAC. Telnet has no fixed binary header, so Apex shows the raw bytes — text plus the 0xFF command markers — rather than a byte grid.',
  // Intentionally empty: Telnet has no fixed binary header. With headerBytes() => 0
  // the whole TCP segment becomes the payload, exposing the real NVT text and any
  // 0xFF IAC command sequences in the byte view. See the top-of-file comment.
  fields: [],
  headerBytes: () => 0,
  // Telnet is the application layer; the byte stream is the data itself, so there
  // is no child protocol to dispatch to.
};
