// XMPP — Extensible Messaging and Presence Protocol (Jabber), core.
// RFC 6120 (XMPP Core). Address format (JID) is RFC 7622. XMPP runs over TCP,
// by convention on port 5222 (client-to-server, c2s) and 5269 (server-to-server,
// s2s). TLS (STARTTLS) and SASL authentication are negotiated in-band, but the
// framing and stanzas below are pure UTF-8 / US-ASCII XML text.
//
// WHY THIS SPEC HAS NO BIT-FIELDS
// -------------------------------
// Like HTTP (see http.ts), XMPP is a TEXT protocol, not a binary one. There is
// no fixed grid of bits at known offsets to transcribe as `Field`s. An XMPP
// connection is, on the wire, *two open-ended XML documents* (one per direction)
// streamed incrementally. You parse it as XML — by scanning for element tags and
// attributes — never by reading fixed-width integers. Modelling it with invented
// bit offsets would be a lie about the wire, so we model it truthfully:
//
//   * fields: []            — there is no fixed binary header to dissect.
//   * headerBytes: () => 0  — nothing is consumed as a binary header, so the
//                             ENTIRE TCP segment falls through as the payload,
//                             which IS the XML text. The byte view then shows the
//                             real bytes (0x3c 0x3f 0x78 = "<?x…") directly.
//   * no `next`             — the XML stanza content is the application payload;
//                             there is no further generic protocol to dissect.
//
// STREAM FRAMING (RFC 6120 §4)
// ----------------------------
// XMPP does not exchange independent messages; it exchanges XML *streams*. After
// the TCP connection opens, the initiating entity sends an opening stream header
// — a single XML element start tag that is deliberately NOT closed:
//
//   <?xml version='1.0'?>
//   <stream:stream
//       from='juliet@im.example.com'
//       to='im.example.com'
//       version='1.0'
//       xml:lang='en'
//       xmlns='jabber:client'
//       xmlns:stream='http://etherx.jabber.org/streams'>
//
// The receiving entity replies with its own opening <stream:stream …> header
// (adding an `id` stream identifier). From then on, everything each side sends is
// a child element of its <stream:stream> root, appended to the open document.
// The stream is closed at the very end by sending the matching </stream:stream>.
// Key attributes (RFC 6120 §4.7):
//   from / to   — JID or domain of sender / intended recipient (routing).
//   id          — stream identifier, set by the receiving server (§4.7.3).
//   version     — '1.0' signals an RFC 6120-capable stream (enables STARTTLS,
//                 SASL, stream features).
//   xml:lang    — default human language of any human-readable XML character data.
//   xmlns       — default namespace for stanzas: 'jabber:client' (c2s) or
//                 'jabber:server' (s2s).
//   xmlns:stream— the stream namespace, fixed: 'http://etherx.jabber.org/streams'.
//
// STANZAS (RFC 6120 §8) — the three first-level "primitives" of XMPP:
//   <message>   §8.2.1 — a push (fire-and-forget) for IM/notifications. Body text
//                        lives in a child <body>…</body>. type=chat|groupchat|
//                        headline|normal|error.
//   <presence>  §8.2.2 — a publish/subscribe broadcast of availability. <show>,
//                        <status>, and the type attribute (unavailable, subscribe,
//                        …) describe online state.
//   <iq>        §8.2.3 — Info/Query, a request/response RPC. type=get|set|result|
//                        error, correlated by a required `id` attribute.
// Every stanza shares the common attributes: to, from, id, type, xml:lang (§8.1).
//
// We do not parse the XML here (the stanza bytes are simply the payload); the
// framing is documented so the teaching is complete.
import type { ProtocolSpec } from '../core/types';

export const xmpp: ProtocolSpec = {
  id: 'xmpp',
  name: 'XMPP',
  layer: 7,
  summary:
    'A TEXT, XML-streamed application protocol over TCP/5222 (Jabber). Each direction is one open-ended XML document: an opening <stream:stream …> header that stays open, then a sequence of stanzas — <message>, <presence>, <iq> — appended as child elements, closed at the end by </stream:stream>. Like HTTP, XMPP has no fixed bit-fields; it is framed by XML tags, so Apex shows the raw stanza text rather than a byte grid.',
  // Intentionally empty: XMPP has no fixed binary header. See the top-of-file
  // comment. With headerBytes() => 0 the whole TCP segment becomes the payload,
  // exposing the real UTF-8/ASCII XML bytes in the byte view.
  fields: [],
  // No binary header is consumed, so the entire segment is the XML stream text.
  headerBytes: () => 0,
  // The stanza content is application data (chat bodies, presence, iq queries)
  // with no generic child protocol to dissect, so we stop here.
};
