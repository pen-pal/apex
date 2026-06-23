// WHOIS dissection test. RFC 3912 §2 — a WHOIS query is a single line of ASCII
// text terminated by ASCII CR then ASCII LF ("\r\n"), sent over TCP port 43.
//
// The capture below is the exact query a client sends for `whois example.com`:
// the registry object name followed by CR LF. This is what travels in the TCP
// payload of the first client->server segment of a real WHOIS lookup.
//
// We encode that exact string to its ASCII byte values and dissect starting at
// our own layer ('whois'). Because WHOIS has no binary header (fields: [], and
// headerBytes() => 0), the engine consumes a 0-byte header and the ENTIRE query
// text lands in node.payload. We assert the bytes round-trip back to the exact
// query string — i.e. WHOIS is text-framed by CR LF, not by fixed offsets — and
// that it ends in CR LF as the RFC requires.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { whois } from '../src/protocols/whois';

// RFC 3912 §2: "All requests are terminated with ASCII CR and then ASCII LF."
const QUERY_TEXT = 'example.com\r\n';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const bytes = [...QUERY_TEXT].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(whois);

describe('WHOIS (RFC 3912)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(bytes, 'whois', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire ASCII query as the payload', () => {
    const node = dissect(bytes, 'whois', reg);
    // The whole segment is the payload (header consumed 0 bytes).
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    // And it round-trips back to the exact query text.
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toBe(QUERY_TEXT);
  });

  it('is a single line terminated by CR LF (RFC 3912 §2)', () => {
    const node = dissect(bytes, 'whois', reg);
    // The query object name is the line before the CR LF terminator.
    expect(node.payload.slice(0, 11)).toEqual(
      [...'example.com'].map((c) => c.charCodeAt(0)),
    );
    // The last two bytes MUST be ASCII CR (0x0D) then ASCII LF (0x0A).
    expect(node.payload.slice(-2)).toEqual([0x0d, 0x0a]);
    // The byte view sees real ASCII: 'e','x','a' = 0x65,0x78,0x61.
    expect(node.payload.slice(0, 3)).toEqual([0x65, 0x78, 0x61]);
  });

  it('stops dissecting — the reply is opaque application text (no child)', () => {
    const node = dissect(bytes, 'whois', reg);
    expect(node.child).toBeNull();
  });
});
