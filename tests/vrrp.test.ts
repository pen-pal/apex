import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { inetChecksum } from '../src/core/checksum';
import { vrrp } from '../src/protocols/vrrp';

// A hand-verified VRRPv2 ADVERTISEMENT (RFC 3768 section 5.1), the bytes that
// follow IP (protocol 112). One virtual router, one virtual IP, no auth.
//
// VRRP header (8 bytes):
//   0x21        version=2 (high nibble), type=1 ADVERTISEMENT (low nibble)
//   0x01        Virtual Router ID = 1
//   0x64        Priority = 100 (default backup priority)
//   0x01        Count IP Addrs = 1
//   0x00        Auth Type = 0 (No Authentication)
//   0x01        Adver Int = 1 second
//   0xBA 0x52   Checksum (Internet checksum over the whole message)
// Payload:
//   192.168.0.1 the one virtual IPv4 address (4 bytes)
//   8 bytes of zero authentication data (RFC 2338 layout, sent as zero)
const vrrpMsg = [
  0x21, 0x01, 0x64, 0x01, 0x00, 0x01, 0xba, 0x52, // 8-byte header
  192, 168, 0, 1, // virtual IP address
  0, 0, 0, 0, 0, 0, 0, 0, // authentication data
];

describe('VRRPv2 dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(vrrp);

  it('parses the fixed 8-byte header (RFC 3768)', () => {
    const node = dissect(vrrpMsg, 'vrrp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(8);
    expect(h.get('version')).toBe(2);
    expect(h.get('type')).toBe(1); // ADVERTISEMENT
    expect(h.get('virtualRouterId')).toBe(1);
    expect(h.get('priority')).toBe(100);
    expect(h.get('countIpAddrs')).toBe(1);
    expect(h.get('authType')).toBe(0);
    expect(h.get('advertisementInterval')).toBe(1);
    expect(h.fields.find((f) => f.field.name === 'checksum')!.display).toBe('0xBA52');
    expect(h.fields.find((f) => f.field.name === 'type')!.meaning).toBe('ADVERTISEMENT');
  });

  it('leaves the virtual IP and auth data in the payload (VRRP is top of stack)', () => {
    const node = dissect(vrrpMsg, 'vrrp', reg);
    expect(node.child).toBe(null);
    expect(vrrp.next!(node.header, reg)).toBe(null);
    expect(node.payload.length).toBe(12); // 4-byte address + 8-byte auth data
    expect(node.payload.slice(0, 4)).toEqual([192, 168, 0, 1]);
  });

  it('checksum is the RFC 1071 Internet checksum over the entire message', () => {
    // Recompute over the full message with the checksum field zeroed; the
    // result must equal the 0xBA52 carried on the wire. This anchors the
    // capture to the RFC, not to the spec's own output.
    const zeroed = vrrpMsg.slice();
    zeroed[6] = 0;
    zeroed[7] = 0;
    expect(inetChecksum(zeroed)).toBe(0xba52);
  });
});
