// Telnet dissection test. RFC 854 — Telnet is an 8-bit byte stream of NVT
// US-ASCII text interleaved IN-BAND with IAC (0xFF) command sequences.
//
// The capture below is a hand-verified Telnet snippet of the kind a server sends
// at the start of a session: two option-negotiation commands followed by the
// "login: " prompt text. Each command code is checked against RFC 854:
//
//   FF FD 18   IAC DO  TERMINAL-TYPE   (DO=253=0xFD, option 24=0x18 = TERMINAL-TYPE)
//   FF FB 01   IAC WILL ECHO           (WILL=251=0xFB, option 1=0x01 = ECHO)
//   6C 6F 67 69 6E 3A 20   "login: "   (raw NVT US-ASCII text)
//
// We dissect starting at our own layer ('telnet'). Telnet has no binary header
// (fields: [], headerBytes() => 0), so the engine consumes a 0-byte header and
// the ENTIRE stream lands in node.payload. Assertions are anchored to RFC 854's
// command codes and to the literal ASCII bytes, not to our code's output.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { telnet } from '../src/protocols/telnet';

// RFC 854 command codes.
const IAC = 0xff; // 255 Interpret As Command
const WILL = 0xfb; // 251
const DO = 0xfd; // 253
const OPT_ECHO = 0x01; // option 1 = ECHO
const OPT_TTYPE = 0x18; // option 24 = TERMINAL-TYPE

const prompt = 'login: ';
const promptBytes = [...prompt].map((c) => c.charCodeAt(0));

// IAC DO TERMINAL-TYPE, IAC WILL ECHO, then "login: ".
const bytes = [IAC, DO, OPT_TTYPE, IAC, WILL, OPT_ECHO, ...promptBytes];

const reg = new ProtocolRegistry();
reg.register(telnet);

describe('Telnet (RFC 854)', () => {
  it('has no fixed binary header (in-band, text-and-command stream)', () => {
    const node = dissect(bytes, 'telnet', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire byte stream as the payload', () => {
    const node = dissect(bytes, 'telnet', reg);
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
  });

  it('carries IAC option-negotiation commands in-band (RFC 854)', () => {
    const node = dissect(bytes, 'telnet', reg);
    const p = node.payload;
    // First command: IAC DO TERMINAL-TYPE.
    expect(p.slice(0, 3)).toEqual([255, 253, 24]);
    // Second command: IAC WILL ECHO.
    expect(p.slice(3, 6)).toEqual([255, 251, 1]);
  });

  it('carries raw NVT US-ASCII text after the commands', () => {
    const node = dissect(bytes, 'telnet', reg);
    const text = String.fromCharCode(...node.payload.slice(6));
    expect(text).toBe('login: ');
    // 'l' = 0x6C is the first text byte.
    expect(node.payload[6]).toBe(0x6c);
  });

  it('stops dissecting — Telnet is the application layer (no child)', () => {
    const node = dissect(bytes, 'telnet', reg);
    expect(node.child).toBeNull();
  });
});
