// IRC — Internet Relay Chat client protocol.
// RFC 2812 (IRC: Client Protocol; the message format), with the original
// framing inherited from RFC 1459. IRC runs over TCP, by convention on
// port 6667 (cleartext) — or inside TLS, conventionally on port 6697 (IRCS).
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Like HTTP/1.1 (see http.ts), IRC is a TEXT, line-oriented protocol — not a
// binary one. There is no fixed grid of bits at known offsets to transcribe as
// `Field`s. A message is a single line of US-ASCII characters terminated by a
// CR-LF pair (\r\n), and a field could begin at any byte depending on the
// preceding text. Inventing fixed offsets would be a lie about the wire, so we
// model IRC truthfully: fields: [], headerBytes: () => 0, and the ENTIRE TCP
// payload falls through as the message text for the byte view to show directly.
//
// MESSAGE FORMAT (RFC 2812 §2.3.1)
// --------------------------------
//   message  =  [ ":" prefix SPACE ] command [ params ] crlf
//   prefix   =  servername / ( nickname [ [ "!" user ] "@" host ] )
//   command  =  1*letter / 3digit          ; a word (PRIVMSG, NICK) OR a 3-digit numeric
//   params   =  *14( SPACE middle ) [ SPACE ":" trailing ]
//            =/ 14( SPACE middle ) [ SPACE [ ":" ] trailing ]
//   crlf     =  %x0D %x0A                   ; the CR-LF that ends every message
//
// So a line has up to four logical parts, in this order:
//   1. OPTIONAL prefix — only when sent BY a server. It starts with ':' and names
//      the origin (a server name, or nick!user@host). Clients usually omit it.
//   2. command — either a textual command word (NICK, USER, JOIN, PRIVMSG, PING,
//      QUIT) or a 3-digit numeric REPLY code from a server (001 RPL_WELCOME,
//      433 ERR_NICKNAMEINUSE, 353 RPL_NAMREPLY …).
//   3. params — up to 15 parameters separated by single spaces. Each "middle"
//      parameter contains no spaces. The LAST parameter may be a "trailing"
//      parameter introduced by " :" — everything after that colon (including
//      spaces and further colons) is one value. That is how a chat line like
//      "hello there friends" is carried as a single argument.
//   4. crlf — the \r\n terminator. A whole message SHALL NOT exceed 512 bytes
//      including the trailing CR-LF (so 510 bytes for command + params).
//
// Worked examples (each is one line, ending \r\n):
//   "NICK alice\r\n"                      registration: choose nickname (no prefix)
//   "USER alice 0 * :Alice Liddell\r\n"   registration: ':Alice Liddell' is trailing
//   "JOIN #wonderland\r\n"                join a channel
//   "PRIVMSG #wonderland :hello all\r\n"  channel message; trailing = the chat text
//   "PING :irc.example.com\r\n"           keepalive
//   ":irc.example.com 001 alice :Welcome to the Internet Relay Network alice\r\n"
//                                         server reply: prefix + numeric + trailing
//
// There is no `next`: the trailing text is human chat / command arguments, not a
// further encapsulated protocol, so dissection stops at this layer.
import type { ProtocolSpec } from '../core/types';

export const irc: ProtocolSpec = {
  id: 'irc',
  name: 'IRC',
  layer: 7,
  summary:
    'A TEXT, line-based chat protocol over TCP/6667. Each message is one US-ASCII line ended by CR-LF: an optional ":prefix" (origin, sent by servers), a command word (NICK, PRIVMSG, JOIN) or 3-digit numeric reply (001), up to 15 space-separated params, where a final " :trailing" param may contain spaces. Like HTTP it has no fixed bit-fields — it is framed by \\r\\n, so Apex shows the raw message text rather than a byte grid. (RFC 2812)',
  // Intentionally empty: IRC has no fixed binary header (it is line/CRLF framed
  // text). See the top-of-file comment. With headerBytes() => 0 the whole TCP
  // segment becomes the payload, exposing the real ASCII message bytes.
  fields: [],
  // No binary header is consumed, so the entire segment is the message text.
  headerBytes: () => 0,
  // The line content is chat text / command arguments, not a child protocol.
};
