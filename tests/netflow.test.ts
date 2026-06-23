import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { netflow } from '../src/protocols/netflow';
import { dissect } from '../src/core/engine';

// A hand-verified Cisco NetFlow Export v5 datagram header (24 bytes), as it
// appears in a real export over UDP/2055. Field offsets/widths are anchored to
// the Cisco NetFlow Export Datagram Format (v5). All fields are BIG-ENDIAN.
//
//   off  bytes                 field          value
//   0    00 05                 version        5
//   2    00 02                 count          2 records follow
//   4    00 0F 42 40           sysUptime      1,000,000 ms (1000 s since boot)
//   8    5E 0B E1 00           unix_secs      0x5E0BE100 = 1577836800 (2020-01-01T00:00:00Z)
//   12   00 00 00 64           unix_nsecs     100 ns
//   16   00 00 04 D2           flow_sequence  1234
//   20   01                    engine_type    1
//   21   00                    engine_id      0
//   22   40 64                 sampling       0x4064 -> mode 1 (top 2 bits), interval 100 (low 14)
const header = [
  0x00, 0x05,
  0x00, 0x02,
  0x00, 0x0f, 0x42, 0x40,
  0x5e, 0x0b, 0xe1, 0x00,
  0x00, 0x00, 0x00, 0x64,
  0x00, 0x00, 0x04, 0xd2,
  0x01,
  0x00,
  0x40, 0x64,
];

// Two 48-byte flow records (contents arbitrary here) prove the header is bounded
// to exactly 24 bytes and the records fall through as payload.
const records = [
  ...new Array(48).fill(0xaa),
  ...new Array(48).fill(0xbb),
];
const datagram = [...header, ...records];

describe('NetFlow v5 export header dissection (Cisco v5 format)', () => {
  const reg = new ProtocolRegistry();
  reg.register(netflow);

  it('parses the fixed 24-byte header and stops (no child)', () => {
    const node = dissect(datagram, 'netflow', reg);
    expect(node.header.byteLength).toBe(24);
    // Header bounded to 24; the flow records are the payload.
    expect(node.payload).toEqual(records);
    expect(node.payload.length).toBe(2 * 48);
    expect(node.child).toBeNull();
  });

  it('reads version = 5', () => {
    const node = dissect(datagram, 'netflow', reg);
    expect(node.header.get('version')).toBe(5);
    const f = node.header.fields.find((x) => x.field.name === 'version')!;
    expect(f.meaning).toContain('NetFlow v5');
  });

  it('reads count = 2 records', () => {
    const node = dissect(datagram, 'netflow', reg);
    expect(node.header.get('count')).toBe(2);
    const f = node.header.fields.find((x) => x.field.name === 'count')!;
    expect(f.meaning).toContain('96 bytes');
  });

  it('reads sysUptime, unix_secs, unix_nsecs, flow_sequence (big-endian)', () => {
    const node = dissect(datagram, 'netflow', reg);
    expect(node.header.get('sysUptime')).toBe(1_000_000);
    expect(node.header.get('unixSecs')).toBe(1_577_836_800);
    expect(node.header.get('unixNsecs')).toBe(100);
    expect(node.header.get('flowSequence')).toBe(1234);
    const ts = node.header.fields.find((x) => x.field.name === 'unixSecs')!;
    expect(ts.meaning).toContain('2020-01-01T00:00:00');
  });

  it('reads the 1-byte engine type and id', () => {
    const node = dissect(datagram, 'netflow', reg);
    expect(node.header.get('engineType')).toBe(1);
    expect(node.header.get('engineId')).toBe(0);
  });

  it('splits sampling: top 2 bits = mode, low 14 bits = interval', () => {
    const node = dissect(datagram, 'netflow', reg);
    // 0x4064 = 0b01_00000001100100 -> mode 1, interval 100.
    expect(node.header.get('samplingInterval')).toBe(0x4064);
    const f = node.header.fields.find((x) => x.field.name === 'samplingInterval')!;
    expect(f.meaning).toContain('mode 1');
    expect(f.meaning).toContain('1 in 100');
  });

  it('field bit widths sum to exactly 24 bytes', () => {
    const totalBits = netflow.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(24 * 8);
  });
});
