import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ipv6 } from '../src/protocols/ipv6';

// Hand-verified IPv6 base header (RFC 8200 §3), 40 bytes.
// Built field-by-field; every byte is justified against the RFC so assertions
// anchor to the spec, not to the implementation's own output.
//
//   byte 0      : 0x60  = 0110 0000 -> Version 6 (0110), top nibble of TC = 0
//   byte 1      : 0x00  -> low nibble of TC (0) | top nibble of Flow Label (0)
//   bytes 2-3   : 0x0000 -> rest of Flow Label = 0
//   bytes 4-5   : 0x0014 = 20  -> Payload Length (a 20-byte TCP header follows)
//   byte 6      : 0x06  -> Next Header = 6 (TCP)
//   byte 7      : 0x40  -> Hop Limit = 64
//   bytes 8-23  : 2001:0db8:0000:0000:0000:0000:0000:0001  (RFC 3849 doc prefix)
//   bytes 24-39 : 2001:0db8:0000:0000:0000:0000:0000:0002
const SRC = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01];
const DST = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x02];
const header = [0x60, 0x00, 0x00, 0x00, 0x00, 0x14, 0x06, 0x40, ...SRC, ...DST];

describe('IPv6 dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(ipv6); // register ONLY our own spec

  it('parses the fixed 40-byte header fields', () => {
    const node = dissect([...header, ...new Array(20).fill(0)], 'ipv6', reg);
    const h = node.header;
    expect(h.get('version')).toBe(6);
    expect(h.get('trafficClass')).toBe(0);
    expect(h.get('flowLabel')).toBe(0);
    expect(h.get('payloadLength')).toBe(20);
    expect(h.get('nextHeader')).toBe(6); // TCP
    expect(h.get('hopLimit')).toBe(64);
    expect(h.byteLength).toBe(40);
  });

  it('formats the 128-bit addresses per RFC 5952', () => {
    const node = dissect([...header, ...new Array(20).fill(0)], 'ipv6', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(f('srcAddr').display).toBe('2001:db8::1');
    expect(f('dstAddr').display).toBe('2001:db8::2');
    // 128-bit fields are read as bytes, not a number.
    expect(f('srcAddr').bytes).toEqual(SRC);
  });

  it('bounds the PDU by 40 + Payload Length (no trailing bytes leak in)', () => {
    // Payload Length = 20, header = 40 -> payload should be exactly 20 bytes,
    // and the extra 8 trailing bytes are a trailer, not payload.
    const node = dissect([...header, ...new Array(20).fill(0xaa), ...new Array(8).fill(0xbb)], 'ipv6', reg);
    expect(node.payload.length).toBe(20);
    expect(node.trailer.length).toBe(8);
    // Next Header = 6 selects 'tcp', but tcp isn't registered here, so the
    // engine stops gracefully and there is no child node.
    expect(node.child).toBeNull();
  });

  it('spreads Traffic Class and Flow Label across the byte boundary correctly', () => {
    // Version 6, Traffic Class 0x12, Flow Label 0x34567:
    //   byte 0 = 0110 0001 = 0x61  (version 6 | TC high nibble 0x1)
    //   byte 1 = 0010 0011 = 0x23  (TC low nibble 0x2 | Flow Label top nibble 0x3)
    //   bytes 2-3 = 0x4567        (rest of the 20-bit Flow Label)
    const hdr = [0x61, 0x23, 0x45, 0x67, 0x00, 0x00, 0x3b, 0x40, ...SRC, ...DST];
    const node = dissect(hdr, 'ipv6', reg);
    const h = node.header;
    expect(h.get('version')).toBe(6);
    expect(h.get('trafficClass')).toBe(0x12);
    expect(h.get('flowLabel')).toBe(0x34567);
    expect(h.get('payloadLength')).toBe(0);
    expect(h.get('nextHeader')).toBe(59); // No Next Header
    expect(node.child).toBeNull();
  });
});
