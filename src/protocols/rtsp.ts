// RTSP — Real Time Streaming Protocol, version 1.0.
// RFC 2326 (Real Time Streaming Protocol, H. Schulzrinne, A. Rao, R. Lanphier,
// April 1998). RTSP runs over TCP, by convention on port 554 (UDP is also
// permitted by the RFC but rarely used in practice).
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// RTSP is, by deliberate design, an *HTTP-like TEXT protocol*. RFC 2326 §1.1
// states RTSP "intentionally similar in syntax and operation to HTTP/1.1 so that
// extension mechanisms to HTTP can in most cases also be added to RTSP." A
// message is a sequence of US-ASCII characters delimited by CRLF (\r\n), not by
// bit positions:
//
//   Request:  Request-Line CRLF *( message-header CRLF ) CRLF [ message-body ]
//   Response: Status-Line  CRLF *( message-header CRLF ) CRLF [ message-body ]
//
//   Request-Line = Method SP Request-URI SP RTSP-Version CRLF        (RFC 2326 §6.1)
//   Status-Line  = RTSP-Version SP Status-Code SP Reason-Phrase CRLF (RFC 2326 §7.1)
//   RTSP-Version = "RTSP" "/" 1*DIGIT "." 1*DIGIT                    (RFC 2326 §3.1)
//
// e.g.  "DESCRIBE rtsp://example.com/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n"
//       "RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n"
//
// As with HTTP (see src/protocols/http.ts), there is no field at "bit offset N for
// K bits": a header could be at byte 9 in one request and byte 200 in another, and
// header NAMES are tokens (CSeq, Transport, Session, Range…). It cannot be modelled
// honestly as a Field[] with fixed widths, so we model RTSP truthfully:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the ENTIRE
//                             TCP segment falls through as the payload, which IS the
//                             ASCII message text. The byte view then shows the real
//                             bytes (0x44 0x45 0x53 = "DES" of "DESCRIBE").
//   * no `next`             — an RTSP message body (typically an SDP session
//                             description for DESCRIBE responses) is opaque to this
//                             dissector, so we stop here.
//
// THE METHODS (RFC 2326 §10) — RTSP is a "network remote control" for media:
//   OPTIONS   §10.1  ask the server which methods it supports.
//   DESCRIBE  §10.2  fetch a media description (usually SDP) for a presentation.
//   SETUP     §10.4  negotiate transport (RTP/UDP ports, interleaving) per stream.
//   PLAY      §10.5  start the server sending the continuous media.
//   PAUSE     §10.6  temporarily halt delivery without tearing down state.
//   TEARDOWN  §10.7  stop delivery and free the session resources.
//   ANNOUNCE/RECORD/GET_PARAMETER/SET_PARAMETER/REDIRECT — additional methods.
//
// THE CSeq HEADER (RFC 2326 §12.17): every request carries a CSeq (command
// sequence) number, incremented by one for each distinct request; the matching
// response echoes the same CSeq so the client can pair replies to requests. A
// retransmission keeps the original CSeq.
//
// RTSP CARRIES NO MEDIA. RFC 2326 §1: "the streams controlled by RTSP may use
// RTP, but the operation of RTSP does not depend on the transport mechanism used
// to carry continuous media." RTSP is only the *control* channel; the actual
// audio/video flows separately, normally over RTP (RFC 3550) on the UDP ports
// negotiated in the SETUP request's Transport header. That is why dissection of
// the RTSP TCP stream stops at the text — the media never appears here.
import type { ProtocolSpec, ConversationSpec } from '../core/types';

// The classic RTSP control session as a conversation (RFC 2326 §10, Appendix A).
// All of these flow over the TCP/554 control channel as text; the media that PLAY
// starts flows OUT-OF-BAND over RTP on the ports negotiated by SETUP.
const rtspSession: ConversationSpec = {
  participants: ['client', 'server'],
  steps: [
    {
      from: 'client',
      label: 'DESCRIBE',
      flags: 'CSeq: 1',
      note: 'Client asks for a media description of the presentation URI. The server replies with an SDP body (Content-Type: application/sdp) listing the streams.',
      clientState: 'Init',
      serverState: 'Init',
    },
    {
      from: 'server',
      label: '200 OK + SDP',
      flags: 'CSeq: 1',
      note: 'Server returns the session description; the client learns which media streams exist and their attributes.',
      clientState: 'Init',
      serverState: 'Init',
    },
    {
      from: 'client',
      label: 'SETUP',
      flags: 'CSeq: 2',
      note: 'Client negotiates transport for one stream (e.g. Transport: RTP/AVP;unicast;client_port=8000-8001). This creates server-side session state.',
      clientState: 'Ready',
      serverState: 'Ready',
    },
    {
      from: 'server',
      label: '200 OK (Session)',
      flags: 'CSeq: 2',
      note: 'Server confirms transport and assigns a Session id; both ends are now Ready. RTP ports are fixed but no media flows yet.',
      clientState: 'Ready',
      serverState: 'Ready',
    },
    {
      from: 'client',
      label: 'PLAY',
      flags: 'CSeq: 3',
      note: 'Client tells the server to start streaming (optionally with Range:). After the 200 OK, RTP media begins flowing out-of-band.',
      clientState: 'Playing',
      serverState: 'Playing',
    },
    {
      from: 'server',
      label: '200 OK → RTP flows',
      flags: 'CSeq: 3',
      note: 'Server acknowledges and begins sending RTP packets on the negotiated UDP ports. RTSP itself carries none of this media.',
      clientState: 'Playing',
      serverState: 'Playing',
    },
    {
      from: 'client',
      label: 'TEARDOWN',
      flags: 'CSeq: 4',
      note: 'Client ends the session; the server stops the RTP stream and frees the Session state. Both ends return to Init.',
      clientState: 'Init',
      serverState: 'Init',
    },
  ],
};

export const rtsp: ProtocolSpec = {
  id: 'rtsp',
  name: 'RTSP 1.0',
  layer: 7,
  summary:
    'A TEXT, HTTP-like control protocol over TCP/554 — the "remote control" for streaming media. A message is ASCII: a Request-Line (Method SP URI SP RTSP/1.0) or Status-Line, header field-lines each ended by CRLF, a blank CRLF, then an optional body (usually SDP). Methods DESCRIBE/SETUP/PLAY/PAUSE/TEARDOWN drive playback; each request carries a CSeq the response echoes. RTSP carries NO media — the audio/video flows separately over RTP on the ports SETUP negotiates.',
  // Intentionally empty: RTSP has no fixed binary header. With headerBytes() => 0
  // the whole TCP segment becomes the payload, exposing the ASCII message bytes.
  fields: [],
  headerBytes: () => 0,
  // The body (typically SDP) is opaque to this dissector, and the media is on a
  // separate RTP channel entirely, so dissection stops here.
  conversation: rtspSession,
};
