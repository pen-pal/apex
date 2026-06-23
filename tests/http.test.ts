// HTTP/1.1 dissection test. RFC 9112 §2.1 — an HTTP/1.1 message is US-ASCII
// text: request-line CRLF, *(field-line CRLF), CRLF, [body].
//
// The capture below is a minimal, valid HTTP/1.1 request as it appears in the
// TCP payload of a real `curl http://example.com/` style request:
//
//   GET / HTTP/1.1\r\n
//   Host: example.com\r\n
//   \r\n
//
// We encode that exact string to its ASCII byte values and dissect starting at
// our own layer ('http'). Because HTTP has no binary header (fields: [], and
// headerBytes() => 0), the engine consumes a 0-byte header and the ENTIRE
// message text lands in node.payload. We assert the bytes round-trip back to the
// exact request text — i.e. HTTP is text-framed by CRLF, not by fixed offsets.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { http } from '../src/protocols/http';

const REQUEST_TEXT = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const bytes = [...REQUEST_TEXT].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(http);

describe('HTTP/1.1 (RFC 9112)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(bytes, 'http', reg);
    // No bit-fields and a zero-byte header: the message is pure text.
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire ASCII message as the payload', () => {
    const node = dissect(bytes, 'http', reg);
    // The whole segment is the payload (header consumed 0 bytes).
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    // And it round-trips back to the exact request text.
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toBe(REQUEST_TEXT);
  });

  it('is framed by CRLF, with a blank line ending the headers (RFC 9112 §2.1)', () => {
    const node = dissect(bytes, 'http', reg);
    const decoded = String.fromCharCode(...node.payload);
    const lines = decoded.split('\r\n');
    // request-line, one field-line, then the empty line (trailing '' after CRLFCRLF).
    expect(lines[0]).toBe('GET / HTTP/1.1'); // method SP request-target SP HTTP-version
    expect(lines[1]).toBe('Host: example.com'); // field-name ":" OWS field-value
    expect(lines[2]).toBe(''); // blank line separating headers from the (empty) body
    // The byte view sees real ASCII: 'G','E','T' = 0x47,0x45,0x54.
    expect(node.payload.slice(0, 3)).toEqual([0x47, 0x45, 0x54]);
  });

  it('stops dissecting — the body is opaque application data (no child)', () => {
    const node = dissect(bytes, 'http', reg);
    expect(node.child).toBeNull();
  });
});
