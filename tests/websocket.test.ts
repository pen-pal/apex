import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { websocket } from '../src/protocols/websocket';

// THE canonical masked Text frame from RFC 6455 §5.7 ("A single-frame masked text
// message"): contains "Hello". These exact bytes are published in the RFC, so the
// assertions below are anchored to the standard, not to our own output.
//
//   0x81  0x85  0x37 0xfa 0x21 0x3d  0x7f 0x9f 0x4d 0x51 0x58
//   ----  ----  -----------------     -----------------------
//   base  base  masking key (4B)      masked payload "Hello" (5B)
//
// Byte 0 = 0x81 = 1000 0001 : FIN=1, RSV1/2/3=0, opcode=0x1 (Text)
// Byte 1 = 0x85 = 1000 0101 : MASK=1, payload length = 5
const helloMaskedTextFrame = [
  0x81, 0x85,
  0x37, 0xfa, 0x21, 0x3d, // masking key
  0x7f, 0x9f, 0x4d, 0x51, 0x58, // masked "Hello"
];

function field(node: ReturnType<typeof dissect>, name: string) {
  return node.header.fields.find((f) => f.field.name === name)!;
}

describe('WebSocket dissection (RFC 6455 §5.2 / §5.7)', () => {
  const reg = new ProtocolRegistry();
  reg.register(websocket);

  it('parses the 2-byte base header bit-fields', () => {
    const node = dissect(helloMaskedTextFrame, 'websocket', reg);
    const h = node.header;
    expect(h.get('fin')).toBe(1);
    expect(h.get('rsv1')).toBe(0);
    expect(h.get('rsv2')).toBe(0);
    expect(h.get('rsv3')).toBe(0);
    expect(h.get('opcode')).toBe(0x1);
    expect(h.get('mask')).toBe(1);
    expect(h.get('payloadLength')).toBe(5);
  });

  it('formats opcode and length meanings from the RFC', () => {
    const node = dissect(helloMaskedTextFrame, 'websocket', reg);
    expect(field(node, 'opcode').display).toBe('1 (Text)');
    expect(field(node, 'payloadLength').meaning).toBe('5 bytes');
    // FIN/MASK are single-bit flags set to 1.
    expect(field(node, 'fin').display).toContain('FIN');
    expect(field(node, 'mask').display).toContain('MASK');
  });

  it('treats the base as exactly 2 bytes; key + masked payload fall to payload', () => {
    const node = dissect(helloMaskedTextFrame, 'websocket', reg);
    expect(node.header.byteLength).toBe(2);
    // 4-byte masking key + 5-byte masked payload = 9 bytes after the base.
    expect(node.payload).toEqual([
      0x37, 0xfa, 0x21, 0x3d,
      0x7f, 0x9f, 0x4d, 0x51, 0x58,
    ]);
    expect(node.child).toBeNull();
  });

  it('unmasking the payload with the key yields ASCII "Hello" (RFC 6455 §5.3)', () => {
    const node = dissect(helloMaskedTextFrame, 'websocket', reg);
    const key = node.payload.slice(0, 4);
    const masked = node.payload.slice(4);
    const unmasked = masked.map((b, i) => b ^ key[i % 4]);
    expect(String.fromCharCode(...unmasked)).toBe('Hello');
  });
});
