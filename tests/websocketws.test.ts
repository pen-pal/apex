import { describe, it, expect } from 'vitest';
import { accept, base64, maskPayload, buildFrame, WS_GUID } from '../src/web/websocketws';

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('base64', () => {
  it('encodes the standard vectors', () => {
    expect(base64(new TextEncoder().encode('Man'))).toBe('TWFu');
    expect(base64(new TextEncoder().encode('M'))).toBe('TQ==');
    expect(base64(new TextEncoder().encode('Ma'))).toBe('TWE=');
  });
});

describe('Sec-WebSocket-Accept — RFC 6455 §1.3', () => {
  it('uses the magic GUID', () => {
    expect(WS_GUID).toBe('258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
  });
  it('matches the published example', () => {
    // RFC 6455: key "dGhlIHNhbXBsZSBub25jZQ==" → accept "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
    expect(accept('dGhlIHNhbXBsZSBub25jZQ==')).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  });
});

describe('frames', () => {
  it('masking is reversible (XOR with the 4-byte key)', () => {
    const data = new TextEncoder().encode('hello');
    const key = Uint8Array.from([0x37, 0xfa, 0x21, 0x3d]);
    expect(hex(maskPayload(maskPayload(data, key), key))).toBe(hex(data)); // mask∘mask = identity
  });
  it('a text frame sets FIN+opcode and the mask bit + length', () => {
    const f = buildFrame(0x1, new TextEncoder().encode('hi'), Uint8Array.from([1, 2, 3, 4]));
    expect(f.bytes[0]).toBe(0x81); // FIN=1, opcode=1 (text)
    expect(f.bytes[1]).toBe(0x82); // MASK=1, len=2
    expect(f.masked).toBe(true);
    expect(f.len).toBe(2);
  });
  it('an unmasked frame omits the masking key', () => {
    const f = buildFrame(0xa, new Uint8Array(0)); // pong, no payload
    expect(f.bytes[0]).toBe(0x8a);
    expect(f.bytes[1]).toBe(0x00); // MASK=0, len=0
    expect(f.bytes.length).toBe(2);
  });
});
