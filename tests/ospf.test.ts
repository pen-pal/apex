import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ospf } from '../src/protocols/ospf';

// A hand-verified OSPFv2 Hello packet (RFC 2328 §A.3.1 common header + §A.3.2
// Hello body), as it would appear inside IP protocol 89 to multicast 224.0.0.5.
// Originated by Router 1.1.1.1 in the backbone area 0.0.0.0, null authentication.
//
// Common header (24 bytes):
//   Version          0x02            = 2 (OSPFv2)
//   Type             0x01            = 1 (Hello)
//   Packet length    0x002c          = 44 bytes (24 header + 20 Hello body)
//   Router ID        0x01010101      = 1.1.1.1
//   Area ID          0x00000000      = 0.0.0.0 (backbone)
//   Checksum         0xfa9c          = real RFC 1071 checksum over the whole
//                                       packet EXCLUDING the 64-bit auth field
//   AuType           0x0000          = 0 (null authentication)
//   Authentication   0x0000000000000000 (unused under null auth)
//
// Hello body (20 bytes, RFC 2328 §A.3.2, falls through as node.payload):
//   Network Mask        255.255.255.0
//   HelloInterval       10
//   Options             0x02 (E-bit, external routing capability)
//   Router Priority     1
//   RouterDeadInterval  40
//   Designated Router   0.0.0.0
//   Backup DR           0.0.0.0
const ospfHeader = [
  0x02, 0x01, 0x00, 0x2c, // version=2 type=1 len=44
  0x01, 0x01, 0x01, 0x01, // Router ID 1.1.1.1
  0x00, 0x00, 0x00, 0x00, // Area ID 0.0.0.0
  0xfa, 0x9c, // Checksum
  0x00, 0x00, // AuType = 0 (null)
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Authentication (64 bits)
];
const helloBody = [
  0xff, 0xff, 0xff, 0x00, // Network Mask 255.255.255.0
  0x00, 0x0a, // HelloInterval = 10
  0x02, // Options = 0x02 (E-bit)
  0x01, // Router Priority = 1
  0x00, 0x00, 0x00, 0x28, // RouterDeadInterval = 40
  0x00, 0x00, 0x00, 0x00, // Designated Router 0.0.0.0
  0x00, 0x00, 0x00, 0x00, // Backup DR 0.0.0.0
];

describe('OSPFv2 dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(ospf);

  it('parses the fixed 24-byte common header', () => {
    const node = dissect([...ospfHeader, ...helloBody], 'ospf', reg);
    const h = node.header;
    expect(h.byteLength).toBe(24);
    expect(h.get('version')).toBe(2);
    expect(h.get('type')).toBe(1); // Hello
    expect(h.get('packetLength')).toBe(44);
    // Router ID and Area ID are formatted as dotted-quad IPv4 strings.
    expect(h.fields.find((f) => f.field.name === 'routerId')!.display).toBe('1.1.1.1');
    expect(h.fields.find((f) => f.field.name === 'areaId')!.display).toBe('0.0.0.0');
    expect(h.fields.find((f) => f.field.name === 'checksum')!.display).toBe('0xFA9C');
    expect(h.get('auType')).toBe(0); // null authentication
  });

  it('decodes the Type and AuType enums', () => {
    const node = dissect([...ospfHeader, ...helloBody], 'ospf', reg);
    const h = node.header;
    expect(h.fields.find((f) => f.field.name === 'type')!.display).toBe('1 (Hello)');
    expect(h.fields.find((f) => f.field.name === 'auType')!.display).toBe('0 (Null (no authentication))');
  });

  it('reads the 64-bit Authentication field as raw bytes', () => {
    const node = dissect([...ospfHeader, ...helloBody], 'ospf', reg);
    const auth = node.header.fields.find((f) => f.field.name === 'authentication')!;
    expect(auth.bits).toBe(64);
    expect(auth.bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('bounds the PDU by Packet length and exposes the Hello body as payload', () => {
    // Append trailing IP padding; Packet length=44 must keep it out of the body.
    const node = dissect([...ospfHeader, ...helloBody, 0xff, 0xff, 0xff, 0xff], 'ospf', reg);
    expect(node.payload.length).toBe(20); // 44 - 24-byte header
    expect(node.trailer.length).toBe(4);
    // Hello body starts with the network mask 255.255.255.0.
    expect(node.payload.slice(0, 4)).toEqual([0xff, 0xff, 0xff, 0x00]);
  });

  it('stops dissecting (the body is type-specific, no generic child)', () => {
    const node = dissect([...ospfHeader, ...helloBody], 'ospf', reg);
    expect(ospf.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
  });
});
