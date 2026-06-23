// SIP — Session Initiation Protocol. RFC 3261 (core protocol; obsoletes RFC
// 2543), with the URI syntax in RFC 3261 §19 and the message grammar in §7 and
// §25 (ABNF). SIP is the signalling protocol for VoIP and multimedia sessions:
// it sets up, modifies, and tears down calls. It does NOT carry the media
// itself — the audio/video flows separately in RTP (RFC 3550). The session
// parameters (codecs, IP/port for the media) are carried in the SIP message
// body, almost always as SDP (RFC 4566).
//
// SIP runs over UDP, TCP, or TLS, by convention on port 5060 (cleartext
// UDP/TCP) or 5061 (SIP-over-TLS). UDP is the historical default; large
// messages or those over the path MTU should use a congestion-controlled
// transport such as TCP (RFC 3261 §18.1.1).
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// SIP, like HTTP, is a TEXT, line-oriented protocol — deliberately so: RFC 3261
// §7 says "SIP is a text-based protocol and uses the UTF-8 charset", and its
// message syntax is "an extension of the HTTP/1.1 message syntax". A message is
// a sequence of characters delimited by CRLF (\r\n), not by bit positions, so
// there is no field that lives "at bit offset N for K bits". A SIP message is:
//
//   start-line                                              (RFC 3261 §7.1)
//   *( message-header CRLF )                                (RFC 3261 §7.3)
//   CRLF                          <- the empty line ends the headers
//   [ message-body ]                                        (RFC 3261 §7.4, usually SDP)
//
//   start-line = Request-Line / Status-Line                (RFC 3261 §7.1)
//   Request-Line = Method SP Request-URI SP SIP-Version CRLF
//        e.g.  INVITE sip:bob@biloxi.com SIP/2.0
//   Status-Line  = SIP-Version SP Status-Code SP Reason-Phrase CRLF
//        e.g.  SIP/2.0 200 OK
//
// The six core methods (RFC 3261 §7.1): INVITE (start a session), ACK
// (confirm a final response to an INVITE), BYE (end a session), CANCEL (abort a
// pending request), REGISTER (bind an address-of-record to a contact), OPTIONS
// (query capabilities). Later RFCs add more (INFO, SUBSCRIBE, NOTIFY, MESSAGE,
// PRACK, UPDATE, REFER, PUBLISH).
//
// Six headers are mandatory in every request (RFC 3261 §8.1.1): To, From,
// CSeq, Call-ID, Max-Forwards, and Via. Field-names are tokens followed by ":"
// and a value, exactly like HTTP, and many have one-letter compact forms
// (RFC 3261 §20, §7.3.3): v=Via, f=From, t=To, i=Call-ID, m=Contact, etc.
//
// Because header names are arbitrary tokens and a given header can sit at byte
// 17 in one message and byte 200 in another, this CANNOT be modelled honestly
// as a fixed Field[] grid — inventing offsets would be a lie about the wire. So,
// exactly like http.ts, we model SIP truthfully:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE transport payload falls through as the
//                             node.payload, which IS the ASCII message text. The
//                             byte view then shows the real bytes
//                             (0x49 0x4e 0x56 0x49 0x54 0x45 = "INVITE").
//   * no `next`             — the body is a session description (SDP) or other
//                             opaque application data; SIP framing is text, so
//                             dissection stops here and the body is the payload.
//
// MESSAGE FRAMING (RFC 3261 §18.3): over a stream transport (TCP/TLS) the body
// length MUST be given by Content-Length and the receiver reads exactly that
// many octets after the blank line; over a datagram transport (UDP) the message
// is bounded by the datagram, but Content-Length is still required if a body is
// present. We do not implement these length rules here (the body bytes are
// simply the payload); they are documented so the teaching is complete.
import type { ProtocolSpec } from '../core/types';

export const sip: ProtocolSpec = {
  id: 'sip',
  name: 'SIP',
  layer: 7,
  summary:
    'A TEXT, line-based signalling protocol for VoIP (RFC 3261), over UDP/TCP/TLS port 5060/5061. A message is ASCII/UTF-8: a request-line ("INVITE sip:bob@biloxi.com SIP/2.0") or status-line ("SIP/2.0 200 OK"), header field-lines each ended by CRLF, a blank CRLF, then an optional body — usually SDP describing the media. Its syntax extends HTTP/1.1, so like HTTP it has no fixed bit-fields: it is framed by \\r\\n and ":", and Apex shows the raw message text rather than a byte grid. SIP only sets up the call; the audio/video itself rides in RTP.',
  // Intentionally empty: SIP has no fixed binary header (RFC 3261 §7 — it is a
  // text protocol whose syntax extends HTTP/1.1). See the top-of-file comment.
  // With headerBytes() => 0 the whole transport payload becomes node.payload,
  // exposing the real ASCII message bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire transport payload is the
  // message text (start-line, headers, blank line, optional SDP body).
  headerBytes: () => 0,
  // The body is a session description (SDP) or other opaque application data,
  // and SIP framing is text — there is no generic child to dissect — so we stop.
};
