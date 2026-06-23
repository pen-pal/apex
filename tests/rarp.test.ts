import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { rarp } from '../src/protocols/rarp';

// A hand-verified IPv4-over-Ethernet RARP REQUEST packet (the 28-byte RARP
// payload only, i.e. the bytes that follow the Ethernet EtherType 0x8035).
// Field layout is identical to ARP (RFC 826) with the RARP opcode from RFC 903:
//   00 01            HTYPE = 1   (Ethernet)
//   08 00            PTYPE = 0x0800 (IPv4)
//   06               HLEN  = 6
//   04               PLEN  = 4
//   00 03            OPER  = 3   (RARP request)
//   00 1c 42 9a bc de SHA  = 00:1c:42:9a:bc:de (the asking host's own MAC)
//   00 00 00 00      SPA   = 0.0.0.0 (sender has no IP yet)
//   00 1c 42 9a bc de THA  = 00:1c:42:9a:bc:de (asking about its own MAC)
//   00 00 00 00      TPA   = 0.0.0.0 (the IP we want — the unknown)
const rarpRequest = [
  0x00, 0x01,
  0x08, 0x00,
  0x06,
  0x04,
  0x00, 0x03,
  0x00, 0x1c, 0x42, 0x9a, 0xbc, 0xde,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x1c, 0x42, 0x9a, 0xbc, 0xde,
  0x00, 0x00, 0x00, 0x00,
];

function field(node: ReturnType<typeof dissect>, name: string) {
  return node.header.fields.find((f) => f.field.name === name)!;
}

describe('RARP dissection (RFC 903)', () => {
  const reg = new ProtocolRegistry();
  reg.register(rarp);

  it('parses the fixed header fields', () => {
    const node = dissect(rarpRequest, 'rarp', reg);
    const h = node.header;
    expect(h.get('htype')).toBe(1);
    expect(h.get('ptype')).toBe(0x0800);
    expect(h.get('hlen')).toBe(6);
    expect(h.get('plen')).toBe(4);
    expect(h.get('oper')).toBe(3);
  });

  it('decodes the RARP opcode and enum meanings from RFC 903', () => {
    const node = dissect(rarpRequest, 'rarp', reg);
    expect(field(node, 'htype').display).toBe('1 (Ethernet)');
    expect(field(node, 'ptype').display).toBe('0x0800');
    expect(field(node, 'oper').display).toBe('3 (RARP request)');
  });

  it('parses the four address fields — host looks up its own MAC', () => {
    const node = dissect(rarpRequest, 'rarp', reg);
    expect(field(node, 'sha').display).toBe('00:1c:42:9a:bc:de');
    expect(field(node, 'spa').display).toBe('0.0.0.0');
    // RARP asks "what IP belongs to THIS MAC?" — target HW addr is the host's own MAC.
    expect(field(node, 'tha').display).toBe('00:1c:42:9a:bc:de');
    expect(field(node, 'tpa').display).toBe('0.0.0.0');
  });

  it('is a fixed 28-byte leaf packet with no child or payload', () => {
    const node = dissect(rarpRequest, 'rarp', reg);
    expect(node.header.byteLength).toBe(28);
    expect(node.payload.length).toBe(0);
    expect(node.child).toBeNull();
  });
});
