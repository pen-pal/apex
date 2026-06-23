import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { coap } from '../src/protocols/coap';
import { dissect } from '../src/core/engine';

// Hand-verified CoAP frames (RFC 7252 §3). We model exactly the 4-byte fixed
// header; the Token, Options, 0xFF marker and Payload fall through as
// node.payload. Assertions are anchored to RFC 7252, not to our own output.
//
// CASE 1 — a Confirmable GET request for /.well-known/core, the standard CoAP
// resource-discovery query (RFC 7252 §7 / RFC 6690).
//   byte 0 = 0x40  -> Ver=01 (1), T=00 (CON), TKL=0000 (0 token bytes)
//   byte 1 = 0x01  -> Code 0.01 GET
//   bytes 2-3 = 0x12 0x34 -> Message ID 0x1234
//   then Options (no token, since TKL=0) encode the path as two Uri-Path
//   (option no. 11) TLVs, ".well-known" then "core" (RFC 7252 §3.1, §5.10.1):
//     0xBB        -> Option Delta 11 (Uri-Path), Option Length 11 -> ".well-known"
//     0x04        -> Option Delta 0 (same Uri-Path), Option Length 4 -> "core"
const con_get = [
  0x40, // Ver 1, Type CON (0), TKL 0
  0x01, // Code 0.01 GET
  0x12, 0x34, // Message ID 0x1234
  // Options: Uri-Path ".well-known" then Uri-Path "core"
  0xbb, // delta 11 (Uri-Path), length 11
  0x2e, 0x77, 0x65, 0x6c, 0x6c, 0x2d, 0x6b, 0x6e, 0x6f, 0x77, 0x6e, // ".well-known"
  0x04, // delta 0 (same option Uri-Path), length 4
  0x63, 0x6f, 0x72, 0x65, // "core"
];

// CASE 2 — a piggybacked 2.05 Content ACK response carrying an 8-byte Token and
// a payload after the 0xFF marker.
//   byte 0 = 0x68  -> Ver=01 (1), T=10 (ACK), TKL=1000 (8 token bytes)
//   byte 1 = 0x45  -> Code 0x45 = 69 = 2.05 Content
//   bytes 2-3 = 0x12 0x34 -> Message ID 0x1234 (matches the request's CON)
const ack_content = [
  0x68, // Ver 1, Type ACK (2), TKL 8
  0x45, // Code 2.05 Content (69)
  0x12, 0x34, // Message ID 0x1234
  0x74, 0x6f, 0x6b, 0x65, 0x6e, 0x31, 0x32, 0x33, // 8-byte Token "token123"
  0xff, // payload marker
  0x68, 0x69, // payload "hi"
];

describe('CoAP fixed-header dissection (RFC 7252 §3)', () => {
  const reg = new ProtocolRegistry();
  reg.register(coap);

  it('models exactly the 4-byte fixed header', () => {
    const node = dissect(con_get, 'coap', reg);
    expect(node.header.byteLength).toBe(4);
    expect(node.child).toBeNull();
  });

  it('parses a CON GET: Ver 1, Type CON, TKL 0, Code 0.01, MID 0x1234', () => {
    const node = dissect(con_get, 'coap', reg);
    expect(node.header.get('version')).toBe(1);
    expect(node.header.get('type')).toBe(0);
    expect(node.header.get('tokenLength')).toBe(0);
    expect(node.header.get('code')).toBe(1);
    expect(node.header.get('messageId')).toBe(0x1234);

    const type = node.header.fields.find((f) => f.field.name === 'type')!;
    expect(type.display).toBe('0 (CON (Confirmable))');
    const code = node.header.fields.find((f) => f.field.name === 'code')!;
    expect(code.meaning).toBe('0.01 GET');
    const tkl = node.header.fields.find((f) => f.field.name === 'tokenLength')!;
    expect(tkl.meaning).toBe('0 bytes');
  });

  it('lets the Token/Options/Payload fall through as payload', () => {
    const node = dissect(con_get, 'coap', reg);
    // Everything after byte 3 is options (TKL=0 so no token bytes).
    expect(node.payload).toEqual(con_get.slice(4));
  });

  it('parses a piggybacked 2.05 Content ACK with an 8-byte token', () => {
    const node = dissect(ack_content, 'coap', reg);
    expect(node.header.get('version')).toBe(1);
    expect(node.header.get('type')).toBe(2); // ACK
    expect(node.header.get('tokenLength')).toBe(8);
    expect(node.header.get('code')).toBe(69); // 2.05 Content

    const type = node.header.fields.find((f) => f.field.name === 'type')!;
    expect(type.display).toBe('2 (ACK (Acknowledgement))');
    const code = node.header.fields.find((f) => f.field.name === 'code')!;
    expect(code.meaning).toBe('2.05 Content');
    // The MID matches the request it acknowledges.
    expect(node.header.get('messageId')).toBe(0x1234);
  });

  it('code class.detail split: 69 = class 2, detail 5; 132 = class 4, detail 4', () => {
    expect((69 >> 5) & 0x7).toBe(2);
    expect(69 & 0x1f).toBe(5);
    expect((132 >> 5) & 0x7).toBe(4);
    expect(132 & 0x1f).toBe(4);
  });

  it('field bit widths sum to exactly 4 bytes', () => {
    const totalBits = coap.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(32);
  });
});
