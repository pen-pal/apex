import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { stun } from '../src/protocols/stun';

// A hand-verified STUN Binding Request, the kind a WebRTC/ICE agent sends to a
// STUN server (e.g. stun:stun.l.google.com:19302) to discover its public
// address. Byte values cross-checked against RFC 8489 §5.
//
// Header (20 bytes), big-endian:
//   bytes 0-1   = 0x00 0x01  -> Message Type 0x0001 = Binding Request
//                              (top 2 bits 0; method=Binding 0x001; class=00 Request)
//   bytes 2-3   = 0x00 0x00  -> Message Length 0 (no attributes after the header)
//   bytes 4-7   = 0x21 0x12 0xA4 0x42 -> Magic Cookie 0x2112A442 (fixed)
//   bytes 8-19  = 12-byte Transaction ID (random; fixed sample here)
const txid = [0xb7, 0xe7, 0xa7, 0x01, 0xbc, 0x34, 0xd6, 0x86, 0xfa, 0x87, 0xdf, 0xae];
const bindingRequest = [
  0x00, 0x01, 0x00, 0x00, 0x21, 0x12, 0xa4, 0x42, ...txid,
];

// A Binding Success Response (message type 0x0101) with a non-zero length, to
// exercise pduBytes bounding the attribute bytes as payload. We give it an
// 8-byte attribute body (length=8) plus 4 trailing bytes that must NOT leak in.
const successResponse = [
  0x01, 0x01, 0x00, 0x08, 0x21, 0x12, 0xa4, 0x42, ...txid,
  // 8 bytes of (opaque, unmodeled) attribute data:
  0x00, 0x20, 0x00, 0x04, 0x00, 0x01, 0x00, 0x00,
];
const trailingPadding = [0xde, 0xad, 0xbe, 0xef];

describe('STUN dissection (RFC 8489 §5)', () => {
  const reg = new ProtocolRegistry();
  reg.register(stun);

  it('parses the fixed 20-byte Binding Request header', () => {
    const node = dissect(bindingRequest, 'stun', reg);
    const h = node.header;
    expect(h.byteLength).toBe(20);
    expect(h.get('messageType')).toBe(0x0001);
    expect(h.get('messageLength')).toBe(0);
    expect(h.get('magicCookie')).toBe(0x2112a442);
  });

  it('decodes the message type as a Binding Request', () => {
    const node = dissect(bindingRequest, 'stun', reg);
    const mt = node.header.fields.find((f) => f.field.name === 'messageType')!;
    expect(mt.meaning).toContain('Binding Request');
  });

  it('shows the magic cookie as the fixed STUN constant', () => {
    const node = dissect(bindingRequest, 'stun', reg);
    const mc = node.header.fields.find((f) => f.field.name === 'magicCookie')!;
    expect(mc.display).toBe('0x2112A442');
    expect(mc.meaning).toContain('valid STUN');
  });

  it('reads the 96-bit transaction ID as 12 raw bytes', () => {
    const node = dissect(bindingRequest, 'stun', reg);
    const tx = node.header.fields.find((f) => f.field.name === 'transactionId')!;
    expect(tx.bytes).toEqual(txid);
    expect(tx.bytes!.length).toBe(12);
  });

  it('has no attribute payload for a bare Binding Request', () => {
    const node = dissect(bindingRequest, 'stun', reg);
    expect(node.payload.length).toBe(0);
    expect(node.child).toBeNull();
  });

  it('bounds the attribute payload by Message Length, excluding trailing padding', () => {
    const node = dissect([...successResponse, ...trailingPadding], 'stun', reg);
    expect(node.header.get('messageType')).toBe(0x0101);
    expect(node.header.get('messageLength')).toBe(8);
    // 20-byte header + 8 attribute bytes = 28-byte PDU; the 4 padding bytes are trailer.
    expect(node.payload.length).toBe(8);
    expect(node.trailer).toEqual(trailingPadding);
    expect(node.child).toBeNull();
  });

  it('decodes the Binding Success Response class', () => {
    const node = dissect(successResponse, 'stun', reg);
    const mt = node.header.fields.find((f) => f.field.name === 'messageType')!;
    expect(mt.meaning).toContain('Binding Success Response');
  });
});
