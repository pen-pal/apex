import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { vxlan } from '../src/protocols/vxlan';

// A hand-verified VXLAN header (RFC 7348 §5) followed by the start of the inner
// Ethernet frame it tunnels. Bytes anchored to the RFC, not to our own output.
//
// VXLAN header (8 bytes):
//   Flags     0x08            -> R R R R I R R R = I bit set (valid VNI)
//   Reserved  0x00 00 00      -> reserved, zero
//   VNI       0x01 02 03      -> 0x010203 = 66051
//   Reserved  0x00            -> reserved low byte of the VNI word
const vxlanHeader = [0x08, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x00];

// Inner Ethernet II frame (RFC 7348 tunnels a full L2 frame):
//   dst MAC 00:11:22:33:44:55, src MAC 66:77:88:99:aa:bb, EtherType 0x0800 (IPv4)
const innerEthernet = [
  0x00, 0x11, 0x22, 0x33, 0x44, 0x55, // inner destination MAC
  0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, // inner source MAC
  0x08, 0x00, // EtherType = IPv4
];

describe('VXLAN dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(vxlan);

  it('parses the fixed 8-byte header', () => {
    const node = dissect([...vxlanHeader, ...innerEthernet], 'vxlan', reg);
    const h = node.header;
    expect(h.byteLength).toBe(8);
    // Flags = 0x08 -> only the I bit is set.
    expect(h.get('flags')).toBe(0x08);
    expect(h.fields.find((f) => f.field.name === 'flags')!.display).toContain('I');
    // 24-bit VNI 0x010203 = 66051.
    expect(h.get('vni')).toBe(66051);
    // Reserved fields are zero.
    expect(h.get('reserved0')).toBe(0);
    expect(h.get('reserved1')).toBe(0);
  });

  it('treats its payload as an inner Ethernet frame (the MAC-in-UDP point)', () => {
    const node = dissect([...vxlanHeader, ...innerEthernet], 'vxlan', reg);
    // No Ethernet spec registered here, so the inner frame lands in node.payload.
    expect(vxlan.next!(node.header, reg)).toBe('ethernet');
    expect(node.payload.length).toBe(innerEthernet.length);
    // The payload begins with the inner destination MAC.
    expect(node.payload.slice(0, 6)).toEqual([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
  });
});
