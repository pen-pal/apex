// POP3 dissection test. RFC 1939 §3 — POP3 is a US-ASCII, line-oriented
// dialogue: command lines (client) and status responses (server), each ended by
// CRLF. The two status indicators are exactly "+OK" and "-ERR".
//
// The captures below are real POP3 lines drawn straight from the worked example
// session in RFC 1939 (the "mrose" maildrop). Each is the ASCII text as it
// appears in the TCP payload. We dissect starting at our own layer ('pop3').
// Because POP3 has no binary header (fields: [], headerBytes() => 0), the engine
// consumes a 0-byte header and the ENTIRE line lands in node.payload. We assert
// the bytes round-trip to the exact ASCII — i.e. POP3 is text-framed by CRLF.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { pop3 } from '../src/protocols/pop3';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(pop3);

describe('POP3 (RFC 1939)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(ascii('+OK POP3 server ready\r\n'), 'pop3', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes a "+OK" server greeting as the payload, byte-exact', () => {
    // RFC 1939 §3: the server opens with a one-line "+OK" greeting.
    const GREETING = '+OK POP3 server ready\r\n';
    const bytes = ascii(GREETING);
    const node = dissect(bytes, 'pop3', reg);

    expect(node.payload).toEqual(bytes);
    expect(String.fromCharCode(...node.payload)).toBe(GREETING);
    // The byte view sees real ASCII: '+','O','K' = 0x2B,0x4F,0x4B.
    expect(node.payload.slice(0, 3)).toEqual([0x2b, 0x4f, 0x4b]);
    // Lines are CRLF-terminated.
    expect(node.payload.slice(-2)).toEqual([0x0d, 0x0a]);
  });

  it('round-trips a "USER" command line (client -> server)', () => {
    // RFC 1939 §4, worked example: "C: USER mrose".
    const CMD = 'USER mrose\r\n';
    const node = dissect(ascii(CMD), 'pop3', reg);
    expect(String.fromCharCode(...node.payload)).toBe(CMD);
    // 'U','S','E','R' = 0x55,0x53,0x45,0x52.
    expect(node.payload.slice(0, 4)).toEqual([0x55, 0x53, 0x45, 0x52]);
  });

  it('round-trips a "-ERR" negative status line', () => {
    // RFC 1939 §3: the negative status indicator is exactly "-ERR".
    const ERR = '-ERR invalid command\r\n';
    const node = dissect(ascii(ERR), 'pop3', reg);
    expect(String.fromCharCode(...node.payload)).toBe(ERR);
    // '-','E','R','R' = 0x2D,0x45,0x52,0x52.
    expect(node.payload.slice(0, 4)).toEqual([0x2d, 0x45, 0x52, 0x52]);
  });

  it('preserves a multi-line RETR terminator (CRLF "." CRLF)', () => {
    // RFC 1939 §3: a multi-line response ends with a line of just ".".
    const MULTI = '+OK 120 octets\r\nFrom: mrose\r\n.\r\n';
    const bytes = ascii(MULTI);
    const node = dissect(bytes, 'pop3', reg);
    expect(node.payload).toEqual(bytes);
    // The final five octets are CRLF "." CRLF = 0D 0A 2E 0D 0A.
    expect(node.payload.slice(-5)).toEqual([0x0d, 0x0a, 0x2e, 0x0d, 0x0a]);
  });

  it('stops dissecting — mail body is opaque (no child)', () => {
    const node = dissect(ascii('+OK\r\n'), 'pop3', reg);
    expect(node.child).toBeNull();
  });
});
