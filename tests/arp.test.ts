import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { arp } from '../src/protocols/arp';

// A hand-verified IPv4-over-Ethernet ARP REQUEST packet (the 28-byte ARP
// payload only, i.e. the bytes that follow the Ethernet EtherType 0x0806).
// Field layout per RFC 826 (HTYPE=Ethernet, PTYPE=IPv4, HLEN=6, PLEN=4):
//   00 01            HTYPE = 1   (Ethernet)
//   08 00            PTYPE = 0x0800 (IPv4)
//   06               HLEN  = 6
//   04               PLEN  = 4
//   00 01            OPER  = 1   (request)
//   00 1c 42 9a bc de SHA  = 00:1c:42:9a:bc:de
//   c0 a8 01 0a      SPA   = 192.168.1.10
//   00 00 00 00 00 00 THA  = 00:00:00:00:00:00 (unknown — what we are asking for)
//   c0 a8 01 01      TPA   = 192.168.1.1   ("who has 192.168.1.1?")
const arpRequest = [
  0x00, 0x01,
  0x08, 0x00,
  0x06,
  0x04,
  0x00, 0x01,
  0x00, 0x1c, 0x42, 0x9a, 0xbc, 0xde,
  0xc0, 0xa8, 0x01, 0x0a,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xc0, 0xa8, 0x01, 0x01,
];

function field(node: ReturnType<typeof dissect>, name: string) {
  return node.header.fields.find((f) => f.field.name === name)!;
}

describe('ARP dissection (RFC 826)', () => {
  const reg = new ProtocolRegistry();
  reg.register(arp);

  it('parses the fixed header fields', () => {
    const node = dissect(arpRequest, 'arp', reg);
    const h = node.header;
    expect(h.get('htype')).toBe(1);
    expect(h.get('ptype')).toBe(0x0800);
    expect(h.get('hlen')).toBe(6);
    expect(h.get('plen')).toBe(4);
    expect(h.get('oper')).toBe(1);
  });

  it('formats the enum/hex meanings from the RFC', () => {
    const node = dissect(arpRequest, 'arp', reg);
    expect(field(node, 'htype').display).toBe('1 (Ethernet)');
    expect(field(node, 'ptype').display).toBe('0x0800');
    expect(field(node, 'oper').display).toBe('1 (request)');
  });

  it('parses the four address fields', () => {
    const node = dissect(arpRequest, 'arp', reg);
    expect(field(node, 'sha').display).toBe('00:1c:42:9a:bc:de');
    expect(field(node, 'spa').display).toBe('192.168.1.10');
    expect(field(node, 'tha').display).toBe('00:00:00:00:00:00');
    expect(field(node, 'tpa').display).toBe('192.168.1.1');
  });

  it('is a fixed 28-byte leaf packet with no child or payload', () => {
    const node = dissect(arpRequest, 'arp', reg);
    expect(node.header.byteLength).toBe(28);
    expect(node.payload.length).toBe(0);
    expect(node.child).toBeNull();
  });
});
