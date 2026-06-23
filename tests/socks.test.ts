import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { socks } from '../src/protocols/socks';

// A hand-verified SOCKS5 CONNECT request to an IPv4 destination, per RFC 1928 §4.
// These are the bytes the client sends over the TCP/1080 connection AFTER method
// negotiation has selected the no-auth method.
//
//   05            VER  = 5            (SOCKS5)
//   01            CMD  = 1            (CONNECT)
//   00            RSV  = 0            (reserved)
//   01            ATYP = 1            (IPv4 address)
//   5d b8 d8 22   DST.ADDR = 93.184.216.34   (4 octets, network order)
//   01 bb         DST.PORT = 443      (0x01bb, network order)
//
// Total = 4-byte fixed prefix + 6-byte payload (4 address + 2 port) = 10 bytes.
const connectRequest = [
  0x05,
  0x01,
  0x00,
  0x01,
  0x5d, 0xb8, 0xd8, 0x22,
  0x01, 0xbb,
];

function field(node: ReturnType<typeof dissect>, name: string) {
  return node.header.fields.find((f) => f.field.name === name)!;
}

describe('SOCKS5 request dissection (RFC 1928 §4)', () => {
  const reg = new ProtocolRegistry();
  reg.register(socks);

  it('parses the fixed 4-byte prefix fields', () => {
    const node = dissect(connectRequest, 'socks', reg);
    const h = node.header;
    expect(h.get('ver')).toBe(5);
    expect(h.get('cmd')).toBe(1);
    expect(h.get('rsv')).toBe(0);
    expect(h.get('atyp')).toBe(1);
  });

  it('formats the enum meanings from the RFC', () => {
    const node = dissect(connectRequest, 'socks', reg);
    expect(field(node, 'cmd').display).toBe('1 (CONNECT)');
    expect(field(node, 'atyp').display).toBe('1 (IPv4 address)');
  });

  it('treats the destination address + port as bounded payload (no child)', () => {
    const node = dissect(connectRequest, 'socks', reg);
    // Fixed prefix is 4 bytes.
    expect(node.header.byteLength).toBe(4);
    // DST.ADDR (4 bytes IPv4) + DST.PORT (2 bytes) = 6 bytes of payload.
    expect(node.payload).toEqual([0x5d, 0xb8, 0xd8, 0x22, 0x01, 0xbb]);
    // SOCKS is a leaf at this layer: no encapsulated child protocol.
    expect(node.child).toBeNull();
  });

  it('payload encodes destination 93.184.216.34:443 (RFC 1928 network order)', () => {
    const node = dissect(connectRequest, 'socks', reg);
    const p = node.payload;
    // IPv4 address octets.
    expect([p[0], p[1], p[2], p[3]]).toEqual([93, 184, 216, 34]);
    // Port is big-endian (network octet order): 0x01bb = 443 (HTTPS).
    expect((p[4] << 8) | p[5]).toBe(443);
  });
});
