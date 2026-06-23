import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { bgp } from '../src/protocols/bgp';
import { dissect } from '../src/core/engine';

// A real BGP KEEPALIVE message (RFC 4271 §4.4): just the fixed 19-octet header,
// Length == 19 and Type == 4 (KEEPALIVE), with NO body. This is the heartbeat a
// BGP speaker sends to keep the Hold Timer alive. We model from the start of the
// BGP message; the underlying TCP/179 framing is out of scope.
//
// Layout (RFC 4271 §4.1), big-endian on the wire:
//   0   FF x16                  Marker = all ones (16 octets)
//  16   00 13                   Length = 0x0013 = 19  (header only)
//  18   04                      Type = 4 (KEEPALIVE)
const keepalive = [
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, // Marker (16 x 0xFF)
  0x00, 0x13, // Length = 19
  0x04, // Type = 4 (KEEPALIVE)
];

// A hand-verified BGP OPEN message header (RFC 4271 §4.2). Length = 0x001d = 29,
// so a 10-octet OPEN body follows the 19-octet header:
//   Version(1)=4, My AS(2)=64512, Hold Time(2)=180, BGP Identifier(4)=10.0.0.1,
//   Opt Parm Len(1)=0. We assert only that the body falls through as payload
//   (the OPEN body is a separate, variable structure, not modeled here).
//   0   FF x16                  Marker = all ones
//  16   00 1d                   Length = 0x001d = 29  (19 header + 10 body)
//  18   01                      Type = 1 (OPEN)
const openBody = [
  0x04, // Version = 4
  0xfc, 0x00, // My Autonomous System = 64512
  0x00, 0xb4, // Hold Time = 180
  0x0a, 0x00, 0x00, 0x01, // BGP Identifier = 10.0.0.1
  0x00, // Optional Parameters Length = 0
];
const open = [
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, // Marker
  0x00, 0x1d, // Length = 29
  0x01, // Type = 1 (OPEN)
  ...openBody,
];

describe('BGP-4 message header dissection (RFC 4271 §4.1)', () => {
  const reg = new ProtocolRegistry();
  reg.register(bgp);

  it('parses a KEEPALIVE: fixed 19-byte header, Length 19, no body', () => {
    const node = dissect(keepalive, 'bgp', reg);
    expect(node.header.byteLength).toBe(19);
    expect(node.header.get('length')).toBe(19);
    expect(node.header.get('type')).toBe(4);
    // Length == 19 -> the PDU is header-only; no payload.
    expect(node.payload).toEqual([]);
    expect(node.child).toBeNull();
  });

  it('reads the 16-octet Marker as all-ones bytes', () => {
    const node = dissect(keepalive, 'bgp', reg);
    const marker = node.header.fields.find((x) => x.field.name === 'marker')!;
    expect(marker.bytes).toEqual(new Array(16).fill(0xff));
  });

  it('formats the Type as the named message code', () => {
    const node = dissect(keepalive, 'bgp', reg);
    const t = node.header.fields.find((x) => x.field.name === 'type')!;
    expect(t.display).toBe('4 (KEEPALIVE)');
  });

  it('bounds the PDU by Length: an OPEN body falls through as payload', () => {
    const node = dissect(open, 'bgp', reg);
    expect(node.header.byteLength).toBe(19);
    expect(node.header.get('length')).toBe(29);
    expect(node.header.get('type')).toBe(1);
    const t = node.header.fields.find((x) => x.field.name === 'type')!;
    expect(t.display).toBe('1 (OPEN)');
    // Length 29 -> 10-byte OPEN body, bounded exactly, no child protocol.
    expect(node.payload).toEqual(openBody);
    expect(node.child).toBeNull();
  });

  it('does not let trailing stream bytes leak past Length', () => {
    // Append bytes that would be the start of the NEXT BGP message in the stream.
    const trailing = [0xff, 0xff, 0xff, 0xff];
    const node = dissect([...open, ...trailing], 'bgp', reg);
    // Payload is bounded to exactly the 10-byte OPEN body; trailing bytes excluded.
    expect(node.payload).toEqual(openBody);
  });

  it('field bit widths sum to exactly 19 octets', () => {
    const totalBits = bgp.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(19 * 8);
  });
});
