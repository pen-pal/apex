import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { igmp } from '../src/protocols/igmp';

// A hand-verified IGMPv2 Version 2 Membership Report (RFC 2236, Type 0x16).
// This is the message a host sends to join the LLMNR multicast group
// 224.0.0.252. Layout (8 bytes, the entire IP payload):
//   Type          = 0x16  (Version 2 Membership Report)
//   Max Resp Time = 0x00  (zero in a Report — only meaningful in Queries)
//   Checksum      = 0x0903
//   Group Address = 0xE0 00 00 FC = 224.0.0.252
// The checksum 0x0903 is the real RFC 1071 / RFC 2236 Internet checksum over
// the whole 8-byte message (computed with the checksum field zeroed); it was
// verified to sum the message back to 0x0000.
const report = [
  0x16, 0x00, // Type=0x16 (v2 Membership Report), Max Resp Time=0
  0x09, 0x03, // Checksum
  0xe0, 0x00, 0x00, 0xfc, // Group Address = 224.0.0.252
];

describe('IGMPv2 dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(igmp);

  it('parses the fixed 8-byte message', () => {
    const node = dissect(report, 'igmp', reg);
    const h = node.header;
    expect(h.get('type')).toBe(0x16);
    expect(h.get('maxRespTime')).toBe(0);
    expect(h.get('checksum')).toBe(0x0903);
    expect(h.get('groupAddress')).toBe(0xe00000fc);
    expect(h.byteLength).toBe(8);
  });

  it('decodes the Type enum and the group address', () => {
    const node = dissect(report, 'igmp', reg);
    const typeField = node.header.fields.find((f) => f.field.name === 'type')!;
    expect(typeField.display).toContain('Version 2 Membership Report');
    const groupField = node.header.fields.find((f) => f.field.name === 'groupAddress')!;
    expect(groupField.display).toBe('224.0.0.252');
  });

  it('checksum sums the whole message back to zero (RFC 2236 §2.3)', () => {
    // Internet checksum over the full 8-byte message must fold to 0xFFFF,
    // i.e. the one's-complement sum complemented is 0x0000.
    let sum = 0;
    for (let i = 0; i < report.length; i += 2) sum += (report[i] << 8) + report[i + 1];
    while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
    expect((~sum) & 0xffff).toBe(0);
  });

  it('ends the dissection — no payload above IGMP', () => {
    const node = dissect(report, 'igmp', reg);
    expect(node.child).toBeNull();
    expect(node.payload).toEqual([]);
  });
});
