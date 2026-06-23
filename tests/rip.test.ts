import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { rip } from '../src/protocols/rip';

// A hand-verified RIPv2 Response message (RFC 2453 §4), as it would appear inside
// UDP port 520 to multicast 224.0.0.9. It is a periodic update advertising one
// route: network 192.168.1.0/24, reachable directly (next hop 0.0.0.0), metric 1.
//
// Header (4 bytes):
//   Command       0x02              = 2 (Response)
//   Version       0x02              = 2 (RIPv2)
//   Must Be Zero  0x0000            = reserved
//
// Route Table Entry #1 (20 bytes, RFC 2453 §4 — falls through as node.payload):
//   AFI           0x0002            = 2 (IP / IPv4)
//   Route Tag     0x0000            = 0
//   IP Address    0xc0a80100        = 192.168.1.0
//   Subnet Mask   0xffffff00        = 255.255.255.0 (/24)
//   Next Hop      0x00000000        = 0.0.0.0 (via the originator)
//   Metric        0x00000001        = 1 hop
const ripHeader = [
  0x02, 0x02, 0x00, 0x00, // command=2 version=2 mustBeZero=0
];
const routeEntry = [
  0x00, 0x02, // AFI = 2 (IP)
  0x00, 0x00, // Route Tag = 0
  0xc0, 0xa8, 0x01, 0x00, // IP Address 192.168.1.0
  0xff, 0xff, 0xff, 0x00, // Subnet Mask 255.255.255.0
  0x00, 0x00, 0x00, 0x00, // Next Hop 0.0.0.0
  0x00, 0x00, 0x00, 0x01, // Metric = 1
];

describe('RIPv2 dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(rip);

  it('parses the fixed 4-byte header', () => {
    const node = dissect([...ripHeader, ...routeEntry], 'rip', reg);
    const h = node.header;
    expect(h.byteLength).toBe(4);
    expect(h.get('command')).toBe(2);
    expect(h.get('version')).toBe(2);
    expect(h.get('mustBeZero')).toBe(0);
  });

  it('decodes the Command enum and Version', () => {
    const node = dissect([...ripHeader, ...routeEntry], 'rip', reg);
    const h = node.header;
    expect(h.fields.find((f) => f.field.name === 'command')!.display).toBe('2 (Response)');
    // version has no `type`, so its display is the raw number; the decode() text lands in `meaning`.
    expect(h.fields.find((f) => f.field.name === 'version')!.display).toBe('2');
    expect(h.fields.find((f) => f.field.name === 'version')!.meaning).toBe('2 (RIPv2, RFC 2453)');
    expect(h.fields.find((f) => f.field.name === 'mustBeZero')!.display).toBe('0x0000');
  });

  it('exposes the 20-byte route entry as payload (RTEs are not header fields)', () => {
    const node = dissect([...ripHeader, ...routeEntry], 'rip', reg);
    expect(node.payload.length).toBe(20);
    // RTE begins with AFI = 2 (IP) and ends with Metric = 1.
    expect(node.payload.slice(0, 2)).toEqual([0x00, 0x02]);
    expect(node.payload.slice(4, 8)).toEqual([0xc0, 0xa8, 0x01, 0x00]); // 192.168.1.0
    expect(node.payload.slice(16, 20)).toEqual([0x00, 0x00, 0x00, 0x01]); // metric 1
  });

  it('stops dissecting (RIP is the top of the stack)', () => {
    const node = dissect([...ripHeader, ...routeEntry], 'rip', reg);
    expect(rip.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
  });

  it('parses a Request command (1)', () => {
    const node = dissect([0x01, 0x02, 0x00, 0x00, ...routeEntry], 'rip', reg);
    expect(node.header.fields.find((f) => f.field.name === 'command')!.display).toBe('1 (Request)');
  });
});
