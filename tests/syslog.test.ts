// Syslog dissection test. RFC 5424 §6 — an IETF-format syslog message is
// US-ASCII text: HEADER SP STRUCTURED-DATA [SP MSG], where HEADER is
// "<PRI>VERSION SP TIMESTAMP SP HOSTNAME SP APP-NAME SP PROCID SP MSGID".
//
// The capture below is RFC 5424 §6.5 "Example 1" verbatim (with the UTF-8 BOM
// before the message text, EF BB BF, as the RFC specifies for MSG-UTF8). It is
// the canonical example from the standard, so every asserted value is anchored
// to the RFC text, not to our own output.
//
//   <34>1 2003-10-11T22:14:15.003Z mymachine.example.com su - ID47 - BOM'su root' failed for lonvick on /dev/pts/8
//
// PRI = 34 = facility 4 (security/auth) * 8 + severity 2 (Critical).
//
// We dissect starting at our own layer ('syslog'). Because syslog has no binary
// header (fields: [], headerBytes() => 0), the engine consumes a 0-byte header
// and the ENTIRE message text lands in node.payload. We assert the bytes
// round-trip to the exact RFC example and that the <PRI> decodes per RFC 5424.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { syslog } from '../src/protocols/syslog';

// The MSG part is MSG-UTF8: it begins with the UTF-8 BOM (EF BB BF) per §6.4.
const BOM = '﻿';
const MESSAGE_TEXT =
  "<34>1 2003-10-11T22:14:15.003Z mymachine.example.com su - ID47 - " +
  BOM +
  "'su root' failed for lonvick on /dev/pts/8";

// Encode to bytes: the ASCII header bytes are < 0x80; the leading BOM of MSG is
// the 3-byte UTF-8 sequence EF BB BF. TextEncoder gives us the real wire bytes.
const bytes = [...new TextEncoder().encode(MESSAGE_TEXT)];

const reg = new ProtocolRegistry();
reg.register(syslog);

describe('Syslog (RFC 5424)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(bytes, 'syslog', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire message as the payload and round-trips exactly', () => {
    const node = dissect(bytes, 'syslog', reg);
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    const decoded = new TextDecoder().decode(new Uint8Array(node.payload));
    expect(decoded).toBe(MESSAGE_TEXT);
  });

  it('starts with the "<PRI>" angle-bracket priority (RFC 5424 §6.2.1)', () => {
    const node = dissect(bytes, 'syslog', reg);
    // First byte is '<' (0x3C), then the ASCII digits "34", then '>' (0x3E).
    expect(node.payload[0]).toBe(0x3c); // '<'
    expect(node.payload.slice(1, 3)).toEqual([0x33, 0x34]); // "34"
    expect(node.payload[3]).toBe(0x3e); // '>'
    expect(node.payload[4]).toBe(0x31); // VERSION = '1'
  });

  it('decodes PRI = facility*8 + severity per RFC 5424 §6.2.1', () => {
    const decoded = new TextDecoder().decode(new Uint8Array(bytes));
    const prival = Number(decoded.match(/^<(\d{1,3})>/)![1]);
    expect(prival).toBe(34);
    // Facility = PRIVAL >> 3, Severity = PRIVAL & 7.
    expect(prival >> 3).toBe(4); // facility 4 = security/authorization
    expect(prival & 7).toBe(2); // severity 2 = Critical
  });

  it('carries the space-delimited HEADER fields from the RFC example', () => {
    const node = dissect(bytes, 'syslog', reg);
    const decoded = new TextDecoder().decode(new Uint8Array(node.payload));
    // HEADER = PRI VERSION SP TIMESTAMP SP HOSTNAME SP APP-NAME SP PROCID SP MSGID
    const header = decoded.split(' ').slice(0, 6);
    expect(header[0]).toBe('<34>1'); // PRI + VERSION (no SP between them)
    expect(header[1]).toBe('2003-10-11T22:14:15.003Z'); // TIMESTAMP (RFC3339)
    expect(header[2]).toBe('mymachine.example.com'); // HOSTNAME
    expect(header[3]).toBe('su'); // APP-NAME
    expect(header[4]).toBe('-'); // PROCID = NILVALUE
    expect(header[5]).toBe('ID47'); // MSGID
  });

  it('stops dissecting — the MSG is free-form text (no child)', () => {
    const node = dissect(bytes, 'syslog', reg);
    expect(node.child).toBeNull();
  });
});
