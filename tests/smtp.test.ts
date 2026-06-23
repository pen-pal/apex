// SMTP dissection test. RFC 5321 §4.1/§4.2 — an SMTP dialogue is US-ASCII text:
// command lines (verb [SP args] CRLF) from the client and reply lines (3-digit
// code, then SP or "-", then text, CRLF) from the server.
//
// The captures below are real, hand-verifiable SMTP lines as they appear in the
// TCP payload of a mail session. We dissect starting at our own layer ('smtp').
// Because SMTP has no binary header (fields: [], headerBytes() => 0), the engine
// consumes a 0-byte header and the ENTIRE line text lands in node.payload. We
// assert the bytes round-trip to the exact ASCII — i.e. SMTP is text-framed by
// CRLF, not by fixed offsets.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { smtp } from '../src/protocols/smtp';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const enc = (s: string) => [...s].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(smtp);

describe('SMTP (RFC 5321)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(enc('EHLO relay.example.com\r\n'), 'smtp', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes an EHLO command line as the payload (RFC 5321 §4.1.1.1)', () => {
    const TEXT = 'EHLO relay.example.com\r\n';
    const bytes = enc(TEXT);
    const node = dissect(bytes, 'smtp', reg);
    // Whole segment is the payload (header consumed 0 bytes) and round-trips.
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    expect(String.fromCharCode(...node.payload)).toBe(TEXT);
    // The byte view sees real ASCII: 'E','H','L','O' = 0x45,0x48,0x4C,0x4F.
    expect(node.payload.slice(0, 4)).toEqual([0x45, 0x48, 0x4c, 0x4f]);
    // The line is CRLF-terminated.
    expect(node.payload.slice(-2)).toEqual([0x0d, 0x0a]);
  });

  it('exposes a 220 greeting reply with a 3-digit code (RFC 5321 §4.2)', () => {
    const TEXT = '220 mx.example.net ESMTP ready\r\n';
    const node = dissect(enc(TEXT), 'smtp', reg);
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toBe(TEXT);
    // First three bytes are the ASCII digits of the reply code "220".
    expect(node.payload.slice(0, 3)).toEqual([0x32, 0x32, 0x30]);
    // Final-line replies put a SPACE (0x20) as the 4th character.
    expect(node.payload[3]).toBe(0x20);
  });

  it('marks multiline reply continuation with "-" and the last line with SP (§4.2.1)', () => {
    // A two-line 250 reply to EHLO: first line continues ("-"), last line ends (SP).
    const TEXT = '250-mx.example.net at your service\r\n250 SIZE 35882577\r\n';
    const node = dissect(enc(TEXT), 'smtp', reg);
    const lines = String.fromCharCode(...node.payload).split('\r\n');
    expect(lines[0]).toBe('250-mx.example.net at your service');
    expect(lines[1]).toBe('250 SIZE 35882577');
    expect(lines[2]).toBe(''); // trailing '' after the final CRLF
    // 4th byte of the first line is HYPHEN (0x2D); of the second line is SPACE.
    expect(node.payload[3]).toBe(0x2d);
    const secondLineStart = TEXT.indexOf('250 SIZE');
    expect(node.payload[secondLineStart + 3]).toBe(0x20);
  });

  it('exposes a 354 start-mail-input reply (RFC 5321 §4.1.1.4)', () => {
    const TEXT = '354 Start mail input; end with <CRLF>.<CRLF>\r\n';
    const node = dissect(enc(TEXT), 'smtp', reg);
    expect(String.fromCharCode(...node.payload)).toBe(TEXT);
    expect(node.payload.slice(0, 3)).toEqual([0x33, 0x35, 0x34]);
  });

  it('stops dissecting — message content is opaque (no child)', () => {
    const node = dissect(enc('QUIT\r\n'), 'smtp', reg);
    expect(node.child).toBeNull();
  });
});
