import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { tacacs } from '../src/protocols/tacacs';

// A real TACACS+ Authentication START header, the first packet of a device-login
// AAA session over TCP 49 (RFC 8907 §4.1 common header + §5.1 AUTHEN START body).
// This framing matches the well-known Wireshark TACACS+ sample captures.
//
// Byte layout of the 12-byte common header (RFC 8907 §4.1):
//   0xc0                    version = major 0xc, minor 0x0  (TAC_PLUS_MAJOR_VER, default minor)
//   0x01                    type   = 1 (TAC_PLUS_AUTHEN, authentication)
//   0x01                    seq_no = 1 (first packet; odd => sent by the client)
//   0x00                    flags  = 0 (body IS obfuscated; not single-connect)
//   0x6a 0x73 0x57 0xfa     session_id = 0x6a7357fa (a random per-session id)
//   0x00 0x00 0x00 0x14     length = 20 bytes of (obfuscated) AUTHEN START body
//   --- body (obfuscated, opaque without the shared key) begins ---
//   20 bytes follow, then 6 trailing bytes that must NOT leak into this packet.
const SESSION_ID = 0x6a7357fa;
const BODY_LEN = 0x14; // 20
const header: number[] = [
  0xc0, 0x01, 0x01, 0x00,
  0x6a, 0x73, 0x57, 0xfa,
  0x00, 0x00, 0x00, 0x14,
];
const body: number[] = new Array(BODY_LEN).fill(0x99); // opaque obfuscated body
const trailing: number[] = [0xc0, 0x01, 0x02, 0x00, 0xde, 0xad]; // start of the next packet on the TCP stream
const frame: number[] = [...header, ...body, ...trailing];

describe('TACACS+ common header dissection (RFC 8907 §4.1)', () => {
  const reg = new ProtocolRegistry();
  reg.register(tacacs);

  it('parses the 12-byte common header fields', () => {
    const node = dissect(frame, 'tacacs', reg);
    const h = node.header;
    expect(h.byteLength).toBe(12);
    expect(h.get('version')).toBe(0xc0);
    expect(h.get('type')).toBe(1);
    expect(h.get('seqNo')).toBe(1);
    expect(h.get('flags')).toBe(0x00);
    expect(h.get('sessionId')).toBe(SESSION_ID);
    expect(h.get('length')).toBe(BODY_LEN);
  });

  it('decodes the version nibbles (major 0xc / minor 0x0)', () => {
    const node = dissect(frame, 'tacacs', reg);
    const ver = node.header.fields.find((f) => f.field.name === 'version')!;
    expect(ver.display).toBe('0xC0');
    expect(ver.meaning).toBe('major 12 (0xc), minor 0');
  });

  it('formats the type enum', () => {
    const node = dissect(frame, 'tacacs', reg);
    const t = node.header.fields.find((f) => f.field.name === 'type')!;
    expect(t.display).toBe('1 (TAC_PLUS_AUTHEN (authentication))');
  });

  it('shows no flags set when the body is obfuscated', () => {
    const node = dissect(frame, 'tacacs', reg);
    const fl = node.header.fields.find((f) => f.field.name === 'flags')!;
    expect(fl.display).toBe('none');
  });

  it('decodes the flags bitmask when both defined bits are set (0x05)', () => {
    // 0x05 = UNENCRYPTED (0x01) + SINGLE_CONNECT (0x04)
    const f2 = [...frame];
    f2[3] = 0x05;
    const node = dissect(f2, 'tacacs', reg);
    const fl = node.header.fields.find((f) => f.field.name === 'flags')!;
    expect(fl.display).toBe('SINGLE_CONNECT, UNENCRYPTED');
  });

  it('bounds the PDU to 12 + length so the next packet does not leak into the body', () => {
    const node = dissect(frame, 'tacacs', reg);
    expect(node.payload.length).toBe(BODY_LEN); // the body only
    expect(node.payload[0]).toBe(0x99);
    expect(node.trailer.length).toBe(trailing.length); // the following packet is trailer, not body
    expect(node.trailer[0]).toBe(0xc0);
  });

  it('stops dissecting: the obfuscated body is opaque to this layer', () => {
    const node = dissect(frame, 'tacacs', reg);
    expect(node.child).toBeNull();
  });
});
