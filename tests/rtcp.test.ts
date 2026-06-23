import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { rtcp } from '../src/protocols/rtcp';

// A hand-verified RTCP Sender Report (RFC 3550 §6.4.1) with zero reception
// report blocks (RC=0) — the kind a media sender emits to map its RTP timestamp
// to wall-clock time. Total 28 bytes => length = 28/4 - 1 = 6.
//
// Common header (4 bytes), big-endian:
//   byte 0  = 0x80  -> V=2 (10), P=0, RC=0                  (10 0 00000)
//   byte 1  = 0xC8  -> PT = 200 (SR, Sender Report)
//   bytes 2-3 = 0x0006 = 6      length (in 32-bit words minus one => 28 bytes)
// Sender Report body (24 bytes, opaque to this layer):
//   bytes 4-7   = 0xDEADBEEF             SSRC of sender
//   bytes 8-15  = NTP timestamp (8 B)
//   bytes 16-19 = RTP timestamp (4 B)
//   bytes 20-23 = sender's packet count (4 B)
//   bytes 24-27 = sender's octet count (4 B)
const srHeader = [0x80, 0xc8, 0x00, 0x06];
const srBody = [
  0xde, 0xad, 0xbe, 0xef, // SSRC of sender
  0x83, 0xaa, 0x7e, 0x80, 0x00, 0x00, 0x00, 0x00, // NTP timestamp (64-bit)
  0x00, 0x01, 0x5f, 0x90, // RTP timestamp = 90000
  0x00, 0x00, 0x00, 0x64, // packet count = 100
  0x00, 0x00, 0x4e, 0x20, // octet count = 20000
];

describe('RTCP dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(rtcp);

  it('parses the 4-byte common header of a Sender Report', () => {
    const node = dissect([...srHeader, ...srBody], 'rtcp', reg);
    const h = node.header;
    expect(h.byteLength).toBe(4);
    expect(h.get('version')).toBe(2);
    expect(h.get('padding')).toBe(0);
    expect(h.get('reportCount')).toBe(0); // RC = 0 reception report blocks
    expect(h.get('packetType')).toBe(200); // SR
    expect(h.get('length')).toBe(6); // (28/4) - 1
  });

  it('decodes the packet type 200 as a Sender Report', () => {
    const node = dissect([...srHeader, ...srBody], 'rtcp', reg);
    const pt = node.header.fields.find((f) => f.field.name === 'packetType')!;
    expect(pt.meaning).toContain('SR');
  });

  it('decodes the length as (length+1)*4 = 28 bytes', () => {
    const node = dissect([...srHeader, ...srBody], 'rtcp', reg);
    const len = node.header.fields.find((f) => f.field.name === 'length')!;
    expect(len.meaning).toContain('28 bytes');
  });

  it('bounds the PDU by length and leaves the SR body as opaque payload', () => {
    const node = dissect([...srHeader, ...srBody], 'rtcp', reg);
    // (length+1)*4 = 28 total => 24-byte body after the 4-byte header.
    expect(node.payload.length).toBe(24);
    expect(node.child).toBeNull(); // no further dissectable protocol
  });

  it('does not let trailing bytes (e.g. a following compound sub-packet) leak in', () => {
    // Append 8 stray bytes simulating a following RR sub-packet in a compound
    // datagram; `length` must bound this SR to 28 bytes regardless.
    const trailing = [0x81, 0xc9, 0x00, 0x01, 0x11, 0x22, 0x33, 0x44];
    const node = dissect([...srHeader, ...srBody, ...trailing], 'rtcp', reg);
    // PDU bounded to (6+1)*4 = 28 bytes: 4-byte header + 24-byte body.
    expect(node.payload.length).toBe(24);
    expect(node.trailer.length).toBe(8); // the next sub-packet is trailer here
  });

  it('reads RC as a source count (SC) field for BYE packets', () => {
    // A BYE (PT=203) with SC=1: one SSRC follows. First byte 0x81 (V=2, SC=1).
    const bye = [0x81, 0xcb, 0x00, 0x01, 0xde, 0xad, 0xbe, 0xef];
    const node = dissect(bye, 'rtcp', reg);
    expect(node.header.get('packetType')).toBe(203);
    expect(node.header.get('reportCount')).toBe(1);
    const rc = node.header.fields.find((f) => f.field.name === 'reportCount')!;
    expect(rc.meaning).toContain('SC');
  });
});
