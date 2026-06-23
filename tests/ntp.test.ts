import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ntp } from '../src/protocols/ntp';

// A hand-verified NTPv4 client request (RFC 5905 §7.3), the 48-byte header.
// This is the canonical shape of a client poll: LI=0, VN=4, Mode=3, all of the
// server-only fields zero, and the single Transmit Timestamp carrying the
// client's send time.
//
//   Byte 0  0x23  = 0b00 100 011 -> LI=0 (no warning), VN=4, Mode=3 (client)
//   Byte 1  0x00  Stratum   = 0  (unspecified, typical for a client request)
//   Byte 2  0x06  Poll      = 6  (signed log2 s -> 2^6 = 64 s)
//   Byte 3  0xEC  Precision = -20 (signed, 0xEC = -20 -> 2^-20 s ~ 0.95 us)
//   4-7     0x00000000  Root Delay       = 0.0 s
//   8-11    0x00000000  Root Dispersion  = 0.0 s
//   12-15   0x00000000  Reference ID     = 0
//   16-23   0x00..      Reference Timestamp = 0 (unset)
//   24-31   0x00..      Origin Timestamp    = 0 (unset)
//   32-39   0x00..      Receive Timestamp   = 0 (unset)
//   40-47   0xE93C7F00 00000000  Transmit Timestamp
//
// TRANSMIT TIMESTAMP seconds 0xE93C7F00 = 3,913,056,000.
// NTP epoch is 1900-01-01; Unix epoch precedes it by 2,208,988,800 s, so the
// Unix time is 3,913,056,000 - 2,208,988,800 = 1,704,067,200
//   = 2024-01-01T00:00:00Z. (Hand-verified against the NTP epoch offset.)
const request = [
  0x23, 0x00, 0x06, 0xec,
  0x00, 0x00, 0x00, 0x00, // root delay
  0x00, 0x00, 0x00, 0x00, // root dispersion
  0x00, 0x00, 0x00, 0x00, // reference id
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reference timestamp
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // origin timestamp
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // receive timestamp
  0xe9, 0x3c, 0x7f, 0x00, 0x00, 0x00, 0x00, 0x00, // transmit timestamp
];

describe('NTP dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(ntp);

  it('parses the fixed 48-byte header', () => {
    const node = dissect(request, 'ntp', reg);
    expect(node.header.byteLength).toBe(48);
    expect(node.raw.length).toBe(48);
  });

  it('splits the first byte into LI / VN / Mode (MSB-first)', () => {
    const h = dissect(request, 'ntp', reg).header;
    expect(h.get('li')).toBe(0); // no warning
    expect(h.get('vn')).toBe(4); // NTPv4
    expect(h.get('mode')).toBe(3); // client
    const mode = h.fields.find((f) => f.field.name === 'mode')!;
    expect(mode.display).toBe('3 (client)');
  });

  it('reads Stratum, Poll, and Precision (Poll/Precision signed log2 s)', () => {
    const h = dissect(request, 'ntp', reg).header;
    expect(h.get('stratum')).toBe(0);
    expect(h.get('poll')).toBe(6); // 2^6 = 64 s
    expect(h.get('precision')).toBe(0xec); // raw byte; -20 as a signed value
    const prec = h.fields.find((f) => f.field.name === 'precision')!;
    expect(prec.meaning).toContain('-20'); // decode interprets 0xEC as signed -20
  });

  it('reads Root Delay / Root Dispersion as 16.16 fixed-point (here 0)', () => {
    const h = dissect(request, 'ntp', reg).header;
    expect(h.get('rootDelay')).toBe(0);
    expect(h.get('rootDispersion')).toBe(0);
    const rd = h.fields.find((f) => f.field.name === 'rootDelay')!;
    expect(rd.meaning).toContain('0.000000 s');
  });

  it('reads the four 64-bit timestamps as 8 raw bytes each', () => {
    const h = dissect(request, 'ntp', reg).header;
    const ts = (name: string) => h.fields.find((f) => f.field.name === name)!;
    // Server-only timestamps are unset (all zero) in a client request.
    expect(ts('referenceTimestamp').bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(ts('originTimestamp').bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(ts('receiveTimestamp').bytes).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    // The Transmit Timestamp carries the client's send time: 2024-01-01T00:00:00Z.
    expect(ts('transmitTimestamp').bytes).toEqual([0xe9, 0x3c, 0x7f, 0x00, 0, 0, 0, 0]);
    // First 4 bytes = seconds since 1900 = 0xE93C7F00 = 3,913,056,000.
    const tb = ts('transmitTimestamp').bytes!;
    const seconds = ((tb[0] << 24) >>> 0) + (tb[1] << 16) + (tb[2] << 8) + tb[3];
    expect(seconds).toBe(3_913_056_000);
    expect(seconds - 2_208_988_800).toBe(1_704_067_200); // = 2024-01-01T00:00:00Z Unix time
    expect(new Date((seconds - 2_208_988_800) * 1000).toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('field bit widths sum to 48 bytes and are byte-aligned', () => {
    const totalBits = ntp.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(48 * 8);
    // The four wide fields are 64-bit and byte-aligned (required for type 'bytes').
    for (const f of ntp.fields.filter((x) => x.bits > 48)) {
      expect(f.bits % 8).toBe(0);
      expect(f.type).toBe('bytes');
    }
  });

  it('is a leaf protocol: no next dispatch', () => {
    expect(ntp.next).toBeUndefined();
  });
});
