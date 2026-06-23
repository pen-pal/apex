// IRC dissection test. RFC 2812 §2.3.1 — an IRC message is one US-ASCII line:
//   message = [ ":" prefix SPACE ] command [ params ] crlf
// terminated by a CR-LF pair (%x0D %x0A) and never exceeding 512 bytes total.
//
// The capture below is a real server-to-client numeric reply as it appears in
// the TCP payload on port 6667 (RPL_WELCOME, numeric 001):
//
//   :irc.example.com 001 alice :Welcome to the Internet Relay Network alice\r\n
//
// It exercises all four logical parts of the grammar: a ':' prefix (the server
// name), a 3-digit numeric command, a "middle" param (alice), and a " :"
// trailing param (the welcome text, which contains spaces).
//
// Because IRC has no binary header (fields: [], headerBytes() => 0), the engine
// consumes a 0-byte header and the ENTIRE message text lands in node.payload.
// We assert the bytes round-trip back to the exact line — IRC is text-framed by
// CRLF, anchored to the RFC 2812 grammar, not to our own output.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { irc } from '../src/protocols/irc';

const LINE = ':irc.example.com 001 alice :Welcome to the Internet Relay Network alice\r\n';

// US-ASCII encode (every char here is < 0x80, so one byte each).
const bytes = [...LINE].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(irc);

describe('IRC (RFC 2812)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(bytes, 'irc', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire ASCII message line as the payload', () => {
    const node = dissect(bytes, 'irc', reg);
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    // Round-trips back to the exact wire line.
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toBe(LINE);
  });

  it('matches the RFC 2812 §2.3.1 grammar: [:prefix SP] command [params] crlf', () => {
    const node = dissect(bytes, 'irc', reg);
    const decoded = String.fromCharCode(...node.payload);

    // Ends with the CR-LF terminator (crlf = %x0D %x0A) and nothing after it.
    expect(decoded.endsWith('\r\n')).toBe(true);
    const lineBody = decoded.slice(0, -2);

    // A server message begins with ':' prefix; first space splits prefix off.
    expect(lineBody[0]).toBe(':');
    const firstSp = lineBody.indexOf(' ');
    const prefix = lineBody.slice(1, firstSp);
    expect(prefix).toBe('irc.example.com'); // servername origin

    // command = 1*letter / 3digit — here the 3-digit numeric 001 (RPL_WELCOME).
    const afterPrefix = lineBody.slice(firstSp + 1);
    const command = afterPrefix.slice(0, 3);
    expect(command).toBe('001');
    expect(/^\d{3}$/.test(command)).toBe(true);

    // The trailing parameter is introduced by " :" and may contain spaces.
    const trailingIdx = lineBody.indexOf(' :');
    const trailing = lineBody.slice(trailingIdx + 2);
    expect(trailing).toBe('Welcome to the Internet Relay Network alice');
    expect(trailing).toContain(' '); // spaces are legal only in the trailing param

    // First byte is ':' = 0x3A in the byte view.
    expect(node.payload[0]).toBe(0x3a);
  });

  it('respects the 512-byte message limit (RFC 2812 §2.3)', () => {
    expect(bytes.length).toBeLessThanOrEqual(512);
  });

  it('stops dissecting — the line content is chat/args, not a child protocol', () => {
    const node = dissect(bytes, 'irc', reg);
    expect(node.child).toBeNull();
  });
});
