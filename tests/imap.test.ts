// IMAP4rev1 dissection test. RFC 3501 §2.2 — every IMAP interaction is a line of
// US-ASCII text ended by CRLF. §2.2.1 (client command): "tag SP command ... CRLF";
// the LOGIN command (RFC 3501 §6.2.3) has form: tag SP "LOGIN" SP userid SP password.
//
// The capture below is a real, valid IMAP client command line as it appears in
// the TCP payload of an IMAP session — the client logging in with a chosen tag:
//
//   a001 LOGIN bob secret\r\n
//
// We encode that exact string to its ASCII byte values and dissect starting at
// our own layer ('imap'). Because IMAP has no binary header (fields: [], and
// headerBytes() => 0), the engine consumes a 0-byte header and the ENTIRE line
// text lands in node.payload. We assert the bytes round-trip back to the exact
// command line — i.e. IMAP is text-framed by CRLF, not by fixed offsets.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { imap } from '../src/protocols/imap';

const COMMAND_TEXT = 'a001 LOGIN bob secret\r\n';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const bytes = [...COMMAND_TEXT].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(imap);

describe('IMAP4rev1 (RFC 3501)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(bytes, 'imap', reg);
    // No bit-fields and a zero-byte header: the line is pure text.
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire ASCII line as the payload', () => {
    const node = dissect(bytes, 'imap', reg);
    // The whole segment is the payload (header consumed 0 bytes).
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    // And it round-trips back to the exact command line.
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toBe(COMMAND_TEXT);
  });

  it('is a tagged command line ended by CRLF (RFC 3501 §2.2.1)', () => {
    const node = dissect(bytes, 'imap', reg);
    const decoded = String.fromCharCode(...node.payload);
    // The line is terminated by CRLF.
    expect(decoded.endsWith('\r\n')).toBe(true);
    // tag SP command SP args (RFC 3501 §6.2.3 LOGIN: tag SP "LOGIN" SP user SP pass).
    const tokens = decoded.slice(0, -2).split(' ');
    expect(tokens[0]).toBe('a001'); // tag — a client-chosen alphanumeric token
    expect(tokens[1]).toBe('LOGIN'); // command keyword
    expect(tokens[2]).toBe('bob'); // userid argument
    expect(tokens[3]).toBe('secret'); // password argument
    // The byte view sees real ASCII: 'a','0','0','1' = 0x61,0x30,0x30,0x31.
    expect(node.payload.slice(0, 4)).toEqual([0x61, 0x30, 0x30, 0x31]);
    // The final two bytes are CR (0x0d) LF (0x0a).
    expect(node.payload.slice(-2)).toEqual([0x0d, 0x0a]);
  });

  it('stops dissecting — the line text is the application data (no child)', () => {
    const node = dissect(bytes, 'imap', reg);
    expect(node.child).toBeNull();
  });
});
