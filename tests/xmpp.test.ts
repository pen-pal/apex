// XMPP dissection test. RFC 6120 §4.2 — an XMPP connection is two open-ended
// XML streams of UTF-8/US-ASCII text. There is no binary header.
//
// The capture below is the opening stream header sent by an initiating client,
// taken verbatim from RFC 6120 §4.2.1 (and the prolog from §11.5 / standard XML),
// exactly as it appears in the TCP payload of a real c2s connection on port 5222:
//
//   <?xml version='1.0'?>
//   <stream:stream from='juliet@im.example.com' to='im.example.com' \
//     version='1.0' xml:lang='en' xmlns='jabber:client' \
//     xmlns:stream='http://etherx.jabber.org/streams'>
//
// We also dissect a real <message> stanza with a <body> (RFC 6120 §8.2.1 /
// §2's "<message>…<body>…" example). We encode each to its ASCII byte values and
// dissect starting at our own layer ('xmpp'). Because XMPP has no binary header
// (fields: [], headerBytes() => 0), the engine consumes a 0-byte header and the
// ENTIRE text lands in node.payload. We assert the bytes round-trip back to the
// exact XML — i.e. XMPP is XML-framed text, not fixed offsets.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { xmpp } from '../src/protocols/xmpp';

// RFC 6120 §4.2.1 — initiating entity's opening stream header (single line as on
// the wire; the unclosed start tag is intentional — the stream stays open).
const STREAM_HEADER =
  "<?xml version='1.0'?>" +
  "<stream:stream from='juliet@im.example.com' to='im.example.com' " +
  "version='1.0' xml:lang='en' xmlns='jabber:client' " +
  "xmlns:stream='http://etherx.jabber.org/streams'>";

// A message stanza with a body (RFC 6120 §8.2.1 form).
const MESSAGE_STANZA =
  "<message to='romeo@example.net' type='chat'><body>Hello, how are you?</body></message>";

// US-ASCII encode (every char here is < 0x80, so one byte each).
const toBytes = (s: string) => [...s].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(xmpp);

describe('XMPP (RFC 6120)', () => {
  it('has no fixed binary header (XML-text-framed protocol)', () => {
    const node = dissect(toBytes(STREAM_HEADER), 'xmpp', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire stream header as the payload and round-trips it', () => {
    const bytes = toBytes(STREAM_HEADER);
    const node = dissect(bytes, 'xmpp', reg);
    expect(node.payload).toEqual(bytes); // whole segment is the payload
    expect(String.fromCharCode(...node.payload)).toBe(STREAM_HEADER);
    // The byte view sees real ASCII: the XML prolog '<','?','x' = 0x3c,0x3f,0x78.
    expect(node.payload.slice(0, 3)).toEqual([0x3c, 0x3f, 0x78]);
  });

  it('carries the stream-framing attributes from RFC 6120 §4.7', () => {
    const node = dissect(toBytes(STREAM_HEADER), 'xmpp', reg);
    const text = String.fromCharCode(...node.payload);
    // Opening start tag is deliberately not self-closed (the stream stays open).
    expect(text).toContain('<stream:stream ');
    expect(text).not.toContain('</stream:stream>');
    // The fixed stream namespace and the default stanza namespace (c2s).
    expect(text).toContain("xmlns:stream='http://etherx.jabber.org/streams'");
    expect(text).toContain("xmlns='jabber:client'");
    expect(text).toContain("version='1.0'");
  });

  it('dissects a <message> stanza, round-tripping the <body> text', () => {
    const bytes = toBytes(MESSAGE_STANZA);
    const node = dissect(bytes, 'xmpp', reg);
    expect(node.payload).toEqual(bytes);
    const text = String.fromCharCode(...node.payload);
    expect(text).toBe(MESSAGE_STANZA);
    // One of the three stanza primitives (RFC 6120 §8.2.1), with a chat body.
    expect(text.startsWith('<message ')).toBe(true);
    expect(text).toContain("type='chat'");
    expect(text).toContain('<body>Hello, how are you?</body>');
  });

  it('stops dissecting — the stanza content is opaque application data (no child)', () => {
    const node = dissect(toBytes(MESSAGE_STANZA), 'xmpp', reg);
    expect(node.child).toBeNull();
  });
});
