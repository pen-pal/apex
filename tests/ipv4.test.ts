import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { registerCoreProtocols } from '../src/protocols';
import { dissect } from '../src/core/engine';

// A real IPv4 header (20 bytes) followed by a tiny placeholder TCP-ish payload.
const ipHeader = [0x45, 0x00, 0x00, 0x28, 0x43, 0x21, 0x40, 0x00, 0x40, 0x06, 0x5e, 0xd4, 192, 168, 1, 42, 142, 250, 72, 14];

describe('IPv4 dissection', () => {
  const reg = new ProtocolRegistry();
  registerCoreProtocols(reg);

  it('parses the fixed fields correctly', () => {
    const node = dissect([...ipHeader, ...new Array(8).fill(0)], 'ipv4', reg);
    const h = node.header;
    expect(h.get('version')).toBe(4);
    expect(h.get('ihl')).toBe(5);
    expect(h.byteLength).toBe(20);
    expect(h.get('protocol')).toBe(6);
    expect(h.get('ttl')).toBe(64);
    expect(node.header.fields.find((f) => f.field.name === 'srcIp')!.display).toBe('192.168.1.42');
    expect(node.header.fields.find((f) => f.field.name === 'dstIp')!.display).toBe('142.250.72.14');
  });

  it('bounds the payload by totalLength (no trailing bytes leak in)', () => {
    // totalLength = 0x28 = 40, header 20 -> payload should be exactly 20 bytes
    const node = dissect([...ipHeader, ...new Array(30).fill(0xaa)], 'ipv4', reg);
    expect(node.payload.length).toBe(20);
    expect(node.trailer.length).toBe(10);
  });
});
