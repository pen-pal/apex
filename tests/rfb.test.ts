import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { rfb } from '../src/protocols/rfb';

// A hand-verified RFB FramebufferUpdateRequest, the 10-byte client-to-server
// message body in the normal phase (RFC 6143 §7.5.3). This is a real-shape
// full-screen request for a 1024x768 framebuffer at the origin, non-incremental.
//   03           message-type = 3   (FramebufferUpdateRequest)
//   00           incremental  = 0   (send the full rectangle)
//   00 00        x-position   = 0
//   00 00        y-position   = 0
//   04 00        width        = 1024  (0x0400, big-endian)
//   03 00        height       = 768   (0x0300, big-endian)
const fbUpdateRequest = [
  0x03,
  0x00,
  0x00, 0x00,
  0x00, 0x00,
  0x04, 0x00,
  0x03, 0x00,
];

function field(node: ReturnType<typeof dissect>, name: string) {
  return node.header.fields.find((f) => f.field.name === name)!;
}

describe('RFB FramebufferUpdateRequest dissection (RFC 6143 §7.5.3)', () => {
  const reg = new ProtocolRegistry();
  reg.register(rfb);

  it('parses every fixed field', () => {
    const node = dissect(fbUpdateRequest, 'rfb', reg);
    const h = node.header;
    expect(h.get('messageType')).toBe(3);
    expect(h.get('incremental')).toBe(0);
    expect(h.get('xPosition')).toBe(0);
    expect(h.get('yPosition')).toBe(0);
    // big-endian U16s
    expect(h.get('width')).toBe(1024);
    expect(h.get('height')).toBe(768);
  });

  it('formats the message-type enum and incremental meaning', () => {
    const node = dissect(fbUpdateRequest, 'rfb', reg);
    expect(field(node, 'messageType').display).toBe('3 (FramebufferUpdateRequest)');
    expect(field(node, 'incremental').meaning).toContain('full update');
  });

  it('is a fixed 10-byte leaf message with no child or payload', () => {
    const node = dissect(fbUpdateRequest, 'rfb', reg);
    expect(node.header.byteLength).toBe(10);
    expect(node.payload.length).toBe(0);
    expect(node.child).toBeNull();
  });

  it('reads width/height big-endian, not little-endian', () => {
    // An incremental full-screen request for a 1920x1080 display.
    const wide = [0x03, 0x01, 0x00, 0x00, 0x00, 0x00, 0x07, 0x80, 0x04, 0x38];
    const node = dissect(wide, 'rfb', reg);
    expect(node.header.get('incremental')).toBe(1);
    expect(node.header.get('width')).toBe(1920); // 0x0780
    expect(node.header.get('height')).toBe(1080); // 0x0438
    expect(field(node, 'incremental').meaning).toContain('incremental');
  });
});
