import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { pppoe } from '../src/protocols/pppoe';

// A PPPoE SESSION-stage frame (EtherType would be 0x8864). Hand-verified against
// RFC 2516 §4. The 6-byte PPPoE header is followed by a PPP frame whose first
// two bytes are the PPP Protocol id 0xC021 = LCP.
//
// PPPoE header:
//   byte 0  0x11  -> VER=0x1 (high nibble), TYPE=0x1 (low nibble)
//   byte 1  0x00  -> CODE = 0x00 (Session Data)
//   bytes 2-3 0x0011 -> SESSION_ID = 0x0011
//   bytes 4-5 0x0014 -> LENGTH = 20 (the PPP frame below is exactly 20 bytes)
//
// PPP payload (20 bytes): protocol 0xC021 (LCP), then an LCP Configure-Request
// (code 0x01, id 0x01, length 0x0012 = 18) with a few options. The exact LCP
// option bytes are opaque here — we only assert the PPPoE header and that the
// PPP frame lands intact in node.payload.
const sessionHeader = [0x11, 0x00, 0x00, 0x11, 0x00, 0x14];
const pppFrame = [
  0xc0, 0x21, // PPP protocol: LCP
  0x01, 0x01, 0x00, 0x12, // LCP Configure-Request, id 1, length 18
  0x01, 0x04, 0x05, 0xd4, // MRU = 1492
  0x05, 0x06, 0x1a, 0x2b, 0x3c, 0x4d, // Magic-Number
  0x07, 0x02, 0x08, 0x02, // Protocol-Field-Compression, Address-Control-Field-Compression
];

// A PADI discovery frame (EtherType would be 0x8863): CODE=0x09, SESSION_ID=0,
// LENGTH=0 (no TAGs in this minimal example).
const padi = [0x11, 0x09, 0x00, 0x00, 0x00, 0x00];

describe('PPPoE dissection (RFC 2516)', () => {
  const reg = new ProtocolRegistry();
  reg.register(pppoe);

  it('parses the fixed 6-byte session header', () => {
    const node = dissect([...sessionHeader, ...pppFrame], 'pppoe', reg);
    const h = node.header;
    expect(h.byteLength).toBe(6);
    expect(h.get('version')).toBe(1);
    expect(h.get('type')).toBe(1);
    expect(h.get('code')).toBe(0x00);
    expect(h.get('sessionId')).toBe(0x0011);
    expect(h.get('length')).toBe(20);
  });

  it('decodes the CODE enum and SESSION_ID display', () => {
    const node = dissect([...sessionHeader, ...pppFrame], 'pppoe', reg);
    const code = node.header.fields.find((f) => f.field.name === 'code')!;
    expect(code.meaning).toBe('Session Data');
    const sid = node.header.fields.find((f) => f.field.name === 'sessionId')!;
    expect(sid.display).toBe('0x0011');
  });

  it('bounds the payload by LENGTH (Ethernet padding does not leak in)', () => {
    // LENGTH=20 -> payload is exactly the 20-byte PPP frame, even with padding.
    const node = dissect([...sessionHeader, ...pppFrame, ...new Array(6).fill(0x00)], 'pppoe', reg);
    expect(node.payload.length).toBe(20);
    expect(node.trailer.length).toBe(6);
    // The PPP frame lands intact, starting with the LCP protocol id 0xC021.
    expect(node.payload.slice(0, 2)).toEqual([0xc0, 0x21]);
  });

  it('a Session frame (code 0x00) carries a PPP frame; Discovery frames stop', () => {
    const session = dissect([...sessionHeader, ...pppFrame], 'pppoe', reg);
    expect(pppoe.next!(session.header, reg)).toBe('ppp'); // session -> PPP
    const discovery = dissect(padi, 'pppoe', reg);
    expect(pppoe.next!(discovery.header, reg)).toBeNull(); // discovery -> opaque TLV tags
  });

  it('parses a PADI discovery frame (CODE 0x09, no session yet)', () => {
    const node = dissect(padi, 'pppoe', reg);
    expect(node.header.get('code')).toBe(0x09);
    expect(node.header.get('sessionId')).toBe(0x0000);
    expect(node.header.get('length')).toBe(0);
    const code = node.header.fields.find((f) => f.field.name === 'code')!;
    expect(code.meaning).toBe('PADI (Active Discovery Initiation)');
  });
});
