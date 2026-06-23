// Syslog — The Syslog Protocol. RFC 5424 (2009; obsoletes the older RFC 3164
// "BSD syslog"). Syslog event messages are most commonly carried over UDP on
// port 514 (RFC 5426), though TLS (RFC 5425) and other transports exist. This
// spec models the IETF-format (RFC 5424) message.
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Like HTTP/1.1, syslog is a TEXT, line-oriented protocol — not a binary header
// at fixed bit offsets. An RFC 5424 message is a sequence of US-ASCII characters
// (the MSG part may be UTF-8) with space-delimited fields; you parse it by
// scanning for spaces, not by reading fixed-width integers. Inventing bit
// offsets would be a lie about the wire, so we model it truthfully:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE UDP payload falls through as node.payload,
//                             which IS the ASCII message text. The byte view then
//                             shows the real bytes (0x3C = '<', 0x33 0x34 = "34").
//   * no `next`             — the MSG is free-form application text; there is no
//                             further protocol to dissect, so dissection stops.
//
// THE MESSAGE FORMAT (RFC 5424 §6)
// --------------------------------
//   SYSLOG-MSG = HEADER SP STRUCTURED-DATA [SP MSG]
//   HEADER     = PRI VERSION SP TIMESTAMP SP HOSTNAME SP APP-NAME
//                SP PROCID SP MSGID
//
//   PRI        = "<" PRIVAL ">"        PRIVAL = 1*3DIGIT, range 0..191
//   VERSION    = NONZERO-DIGIT 0*2DIGIT  (currently always "1")
//   TIMESTAMP  = NILVALUE / RFC3339 full-date "T" full-time (e.g.
//                2003-10-11T22:14:15.003Z) — note the mandatory "T" and the
//                "Z" or numeric offset; up to 6 fractional-second digits.
//   HOSTNAME   = NILVALUE / 1*255 PRINTUSASCII   (FQDN, IP, or hostname)
//   APP-NAME   = NILVALUE / 1*48  PRINTUSASCII   (the program / device)
//   PROCID     = NILVALUE / 1*128 PRINTUSASCII   (PID or change-detection id)
//   MSGID      = NILVALUE / 1*32  PRINTUSASCII   (message type, e.g. "TCPIN")
//   NILVALUE   = "-"      (a single hyphen means "this value is absent")
//
//   STRUCTURED-DATA = NILVALUE / 1*SD-ELEMENT
//   SD-ELEMENT      = "[" SD-ID *(SP SD-PARAM) "]"
//   SD-PARAM        = PARAM-NAME "=" %d34 PARAM-VALUE %d34   (name="value")
//   MSG             = MSG-ANY / MSG-UTF8 ; UTF-8 starts with a BOM (EF BB BF)
//
// THE PRI VALUE (RFC 5424 §6.2.1) — the only "encoded" part:
//   PRIVAL = Facility * 8 + Severity
//     Facility 0..23 (0=kern, 1=user, 2=mail, 3=daemon, 4=auth/security,
//       5=syslog, 6=lpr, 7=news, 8=uucp, 9=cron, 10=authpriv, 11=ftp,
//       12=ntp, 13=audit, 14=alert, 15=cron(2), 16..23=local0..local7)
//     Severity 0..7 (0=Emergency, 1=Alert, 2=Critical, 3=Error, 4=Warning,
//       5=Notice, 6=Informational, 7=Debug)
//   So "<34>" => 34 = 4*8 + 2 => Facility 4 (security/auth), Severity 2
//   (Critical). To recover them: Facility = PRIVAL >> 3 (÷8), Severity =
//   PRIVAL & 7 (mod 8).
//
// Example (RFC 5424 §6.5, Example 1):
//   <34>1 2003-10-11T22:14:15.003Z mymachine.example.com su - ID47
//     - BOM'su root' failed for lonvick on /dev/pts/8
import type { ProtocolSpec } from '../core/types';

export const syslog: ProtocolSpec = {
  id: 'syslog',
  name: 'Syslog',
  layer: 7,
  summary:
    'A TEXT, line-based event-logging protocol over UDP/514. An RFC 5424 message is ASCII: "<PRI>" (PRI = facility*8 + severity) then VERSION, TIMESTAMP, HOSTNAME, APP-NAME, PROCID, MSGID, structured data, and the free-form message — all space-delimited. Like HTTP it has no fixed bit-fields, so Apex shows the raw message text. Decode <34> as facility = 34>>3 = 4 (security), severity = 34&7 = 2 (Critical).',
  // Intentionally empty: syslog has no fixed binary header. See the top-of-file
  // comment. With headerBytes() => 0 the whole UDP payload becomes the payload,
  // exposing the real ASCII message bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire datagram is the message text.
  headerBytes: () => 0,
  // The MSG is free-form application text with no generic child protocol to
  // dissect, so we stop here.
};
