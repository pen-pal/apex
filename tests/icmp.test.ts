import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { icmp } from '../src/protocols/icmp';

// A hand-verified ICMP Echo Request (RFC 792, Type 8 Code 0).
// Layout: Type=0x08, Code=0x00, Checksum=0x4d52, Identifier=0x0001,
// Sequence=0x0009, then the classic 32-byte Windows ping data payload
// ("abcdefghijklmnopqrstuvwabcdefghi"). The checksum 0x4d52 is the real
// RFC 1071 Internet checksum over the whole 40-byte ICMP message (it was
// computed with the checksum field zeroed and verified to sum back to 0).
const payloadData = [
  0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, // abcdefgh
  0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, // ijklmnop
  0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x61, // qrstuvwa
  0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, // bcdefghi
];
const echoRequest = [
  0x08, 0x00, // Type=8 (Echo Request), Code=0
  0x4d, 0x52, // Checksum
  0x00, 0x01, // Identifier = 1
  0x00, 0x09, // Sequence number = 9
  ...payloadData,
];

describe('ICMP dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(icmp);

  it('parses the 4-byte common header plus the rest-of-header word', () => {
    const node = dissect(echoRequest, 'icmp', reg);
    const h = node.header;
    expect(h.get('type')).toBe(8);
    expect(h.get('code')).toBe(0);
    expect(h.get('checksum')).toBe(0x4d52);
    // Rest of Header for Echo = Identifier(0x0001) << 16 | Sequence(0x0009)
    expect(h.get('restOfHeader')).toBe(0x00010009);
    expect(h.byteLength).toBe(8);
  });

  it('decodes the Type enum to a human label', () => {
    const node = dissect(echoRequest, 'icmp', reg);
    const typeField = node.header.fields.find((f) => f.field.name === 'type')!;
    expect(typeField.display).toContain('Echo Request');
  });

  it('stops dissecting and lets the data fall through as payload', () => {
    const node = dissect(echoRequest, 'icmp', reg);
    expect(node.child).toBeNull();
    expect(node.payload).toEqual(payloadData);
  });
});
