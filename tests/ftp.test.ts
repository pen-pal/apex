// FTP control-channel dissection test. RFC 959 §4 — the FTP control channel is
// US-ASCII text: command lines and reply lines, each terminated by the Telnet
// end-of-line CRLF (\r\n).
//
// The captures below are minimal, valid FTP control lines as they appear in the
// TCP/21 payload of a real anonymous-login session:
//
//   server greeting (reply): "220 Service ready\r\n"   (RFC 959 §4.2, code 220)
//   client command:          "USER anonymous\r\n"      (RFC 959 §4.1.1, USER)
//
// We encode each exact string to its ASCII byte values and dissect starting at
// our own layer ('ftp'). Because the FTP control channel has no binary header
// (fields: [], and headerBytes() => 0), the engine consumes a 0-byte header and
// the ENTIRE line text lands in node.payload. We assert the bytes round-trip
// back to the exact line — i.e. FTP control is text-framed by CRLF, not by fixed
// offsets.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ftp } from '../src/protocols/ftp';

const GREETING = '220 Service ready\r\n';
const COMMAND = 'USER anonymous\r\n';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const toBytes = (s: string) => [...s].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(ftp);

describe('FTP control channel (RFC 959)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(toBytes(GREETING), 'ftp', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire ASCII reply line as the payload', () => {
    const bytes = toBytes(GREETING);
    const node = dissect(bytes, 'ftp', reg);
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    // Round-trips back to the exact greeting line.
    expect(String.fromCharCode(...node.payload)).toBe(GREETING);
  });

  it('a reply begins with a 3-digit code and ends in CRLF (RFC 959 §4.2)', () => {
    const node = dissect(toBytes(GREETING), 'ftp', reg);
    const text = String.fromCharCode(...node.payload);
    // "220 Service ready\r\n": 3-digit code, SP, text, CRLF.
    expect(text.slice(0, 3)).toBe('220');
    expect(/^\d{3}[ -]/.test(text)).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    // First digit 2 = Positive Completion (RFC 959 §4.2.1).
    expect(text[0]).toBe('2');
    // The byte view sees real ASCII: '2','2','0' = 0x32,0x32,0x30, then SP=0x20.
    expect(node.payload.slice(0, 4)).toEqual([0x32, 0x32, 0x30, 0x20]);
    // ...and CRLF = 0x0D 0x0A terminates the line.
    expect(node.payload.slice(-2)).toEqual([0x0d, 0x0a]);
  });

  it('a command is an ASCII code with an argument, ended by CRLF (RFC 959 §4.1)', () => {
    const bytes = toBytes(COMMAND);
    const node = dissect(bytes, 'ftp', reg);
    expect(node.payload).toEqual(bytes);
    const text = String.fromCharCode(...node.payload);
    expect(text).toBe('USER anonymous\r\n');
    // command-code SP argument CRLF
    const [code, arg] = text.replace('\r\n', '').split(' ');
    expect(code).toBe('USER');
    expect(arg).toBe('anonymous');
    // 'U','S','E','R' = 0x55,0x53,0x45,0x52 in the byte view.
    expect(node.payload.slice(0, 4)).toEqual([0x55, 0x53, 0x45, 0x52]);
  });

  it('stops dissecting — the control line is the application data (no child)', () => {
    const node = dissect(toBytes(GREETING), 'ftp', reg);
    expect(node.child).toBeNull();
  });
});
