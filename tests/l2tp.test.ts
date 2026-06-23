import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { l2tp } from '../src/protocols/l2tp';

// The first 2 bytes of a real L2TPv2 CONTROL message (RFC 2661 §3.1), the bytes
// that follow UDP/1701. We model and assert only this fixed flags+version word;
// the flag-gated remainder (Length, Tunnel ID, Session ID, Ns, Nr, ...) falls
// through as the payload.
//
// 0xC8 = 1 1 0 0 1 0 0 0  ->  T=1 L=1 x=0 x=0 S=1 x=0 O=0 P=0
// 0x02 = 0 0 0 0 0 0 1 0  ->  reserved nibble=0, Ver=2
//
// This matches the RFC's requirement that control messages have T=1, L=1, S=1,
// O=0, P=0 and Ver=2. We carry two extra bytes (a plausible Length=0x000C) to
// prove the dissector stops after 2 bytes and bounds nothing beyond the header.
const l2tpFlags = 0xc8;
const l2tpVer = 0x02;
const l2tpMsg = [l2tpFlags, l2tpVer, 0x00, 0x0c, 0x00, 0x01, 0x00, 0x00];

describe('L2TPv2 dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(l2tp);

  it('parses the fixed 2-byte flags+version word (RFC 2661 §3.1)', () => {
    const node = dissect(l2tpMsg, 'l2tp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(2);
    // First byte 0xC8: T L x x S x O P  =  1 1 0 0 1 0 0 0
    expect(h.get('type')).toBe(1); // T=1 control message
    expect(h.get('lengthPresent')).toBe(1); // L=1
    expect(h.get('reserved1')).toBe(0);
    expect(h.get('sequencePresent')).toBe(1); // S=1
    expect(h.get('reserved2')).toBe(0);
    expect(h.get('offsetPresent')).toBe(0); // O=0 (required for control)
    expect(h.get('priority')).toBe(0); // P=0 (required for control)
    // Second byte 0x02: reserved nibble + Ver
    expect(h.get('reserved3')).toBe(0);
    expect(h.get('version')).toBe(2); // Ver MUST be 2
  });

  it('decodes the message type as a control message', () => {
    const node = dissect(l2tpMsg, 'l2tp', reg);
    expect(node.header.fields.find((f) => f.field.name === 'type')!.meaning).toBe('Control message');
  });

  it('stops after the 2-byte header; the conditional remainder is payload', () => {
    const node = dissect(l2tpMsg, 'l2tp', reg);
    expect(node.child).toBe(null);
    expect(l2tp.next!(node.header, reg)).toBe(null);
    // Everything past the fixed word stays in the payload (Length, Tunnel ID...).
    expect(node.payload).toEqual([0x00, 0x0c, 0x00, 0x01, 0x00, 0x00]);
  });

  it('the flag bits round-trip the raw first byte exactly', () => {
    const node = dissect(l2tpMsg, 'l2tp', reg);
    const h = node.header;
    // Reassemble the first byte from the individual flag fields, MSB-first.
    const rebuilt =
      (h.get('type') << 7) |
      (h.get('lengthPresent') << 6) |
      (h.get('reserved1') << 4) |
      (h.get('sequencePresent') << 3) |
      (h.get('reserved2') << 2) |
      (h.get('offsetPresent') << 1) |
      h.get('priority');
    expect(rebuilt).toBe(l2tpFlags);
    // And the second byte from the reserved nibble + version.
    expect((h.get('reserved3') << 4) | h.get('version')).toBe(l2tpVer);
  });
});
