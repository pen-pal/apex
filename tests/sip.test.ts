// SIP dissection test. RFC 3261 §7 — a SIP message is US-ASCII/UTF-8 text:
// start-line CRLF, *(message-header CRLF), CRLF, [body].
//
// The capture below is the canonical INVITE request from RFC 3261 §24.2 ("Session
// Setup"), Alice -> Bob. It is reproduced verbatim from the RFC (header order and
// values preserved), with an empty body (Content-Length: 0), so the exact text is
// hand-verifiable against the published example:
//
//   INVITE sip:bob@biloxi.com SIP/2.0\r\n
//   Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds\r\n
//   Max-Forwards: 70\r\n
//   To: Bob <sip:bob@biloxi.com>\r\n
//   From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n
//   Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n
//   CSeq: 314159 INVITE\r\n
//   Contact: <sip:alice@pc33.atlanta.com>\r\n
//   Content-Type: application/sdp\r\n
//   Content-Length: 0\r\n
//   \r\n
//
// We encode that exact string to its ASCII byte values and dissect starting at
// our own layer ('sip'). Because SIP has no binary header (fields: [], and
// headerBytes() => 0), the engine consumes a 0-byte header and the ENTIRE message
// text lands in node.payload. We assert the bytes round-trip back to the exact
// request text — i.e. SIP is text-framed by CRLF, not by fixed offsets.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { sip } from '../src/protocols/sip';

const MESSAGE_TEXT =
  'INVITE sip:bob@biloxi.com SIP/2.0\r\n' +
  'Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds\r\n' +
  'Max-Forwards: 70\r\n' +
  'To: Bob <sip:bob@biloxi.com>\r\n' +
  'From: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n' +
  'Call-ID: a84b4c76e66710@pc33.atlanta.com\r\n' +
  'CSeq: 314159 INVITE\r\n' +
  'Contact: <sip:alice@pc33.atlanta.com>\r\n' +
  'Content-Type: application/sdp\r\n' +
  'Content-Length: 0\r\n' +
  '\r\n';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const bytes = [...MESSAGE_TEXT].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(sip);

describe('SIP (RFC 3261)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(bytes, 'sip', reg);
    // No bit-fields and a zero-byte header: the message is pure text (§7).
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire ASCII message as the payload', () => {
    const node = dissect(bytes, 'sip', reg);
    // The whole transport payload is the payload (header consumed 0 bytes).
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    // And it round-trips back to the exact request text.
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toBe(MESSAGE_TEXT);
  });

  it('is a Request-Line: Method SP Request-URI SP SIP-Version CRLF (§7.1)', () => {
    const node = dissect(bytes, 'sip', reg);
    const decoded = String.fromCharCode(...node.payload);
    const lines = decoded.split('\r\n');
    expect(lines[0]).toBe('INVITE sip:bob@biloxi.com SIP/2.0');
    const [method, uri, version] = lines[0].split(' ');
    expect(method).toBe('INVITE'); // one of the six core methods (§7.1)
    expect(uri).toBe('sip:bob@biloxi.com'); // a SIP Request-URI (§19.1)
    expect(version).toBe('SIP/2.0'); // SIP-Version (§7.1)
    // The byte view sees real ASCII: 'I','N','V' = 0x49,0x4e,0x56.
    expect(node.payload.slice(0, 3)).toEqual([0x49, 0x4e, 0x56]);
  });

  it('carries the six mandatory request headers (§8.1.1)', () => {
    const node = dissect(bytes, 'sip', reg);
    const decoded = String.fromCharCode(...node.payload);
    const lines = decoded.split('\r\n');
    const names = lines
      .filter((l) => l.includes(':'))
      .map((l) => l.split(':')[0]);
    for (const required of ['Via', 'Max-Forwards', 'To', 'From', 'Call-ID', 'CSeq']) {
      expect(names).toContain(required);
    }
    // CSeq value is "sequence-number Method" (§8.1.1.5).
    const cseq = lines.find((l) => l.startsWith('CSeq:'));
    expect(cseq).toBe('CSeq: 314159 INVITE');
  });

  it('a blank line ends the headers; body is empty here (Content-Length: 0)', () => {
    const node = dissect(bytes, 'sip', reg);
    const decoded = String.fromCharCode(...node.payload);
    // The message ends with CRLFCRLF — the empty line separating (absent) body.
    expect(decoded.endsWith('Content-Length: 0\r\n\r\n')).toBe(true);
    const body = decoded.split('\r\n\r\n')[1];
    expect(body).toBe(''); // no SDP body, matching Content-Length: 0
  });

  it('stops dissecting — the body is opaque application data (no child)', () => {
    const node = dissect(bytes, 'sip', reg);
    expect(node.child).toBeNull();
  });
});
