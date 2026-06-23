// DNP3 data-link header dissection test (IEEE 1815-2012 §9).
//
// Hand-verified frame — a "Reset Link States" PRIMARY request, the canonical
// first frame a DNP3 master sends to bring up the link. This is the standard
// worked example in DNP3/IEC 60870-5-2 documentation:
//
//   05 64 05 C0 01 00 04 00 5B CF
//   ^^^^^                          start / sync = 0x05 0x64
//         ^^                       length = 0x05 = 5 (CONTROL+DEST+SOURCE, no user data)
//            ^^                    control = 0xC0 = 1100 0000:
//                                    DIR=1, PRM=1, FCB=0, FCV=0, FN=0 (RESET_LINK_STATES)
//               ^^^^^             destination = 0x01 0x00 little-endian = 1
//                     ^^^^^       source      = 0x04 0x00 little-endian = 4
//                           ^^^^^ block CRC (0x5B 0xCF, low byte first) — part of the
//                                 frame, NOT a header field; CRC verified with the
//                                 DNP3 CRC-16 (poly 0x3D65) over the 8 header octets.
//
// Every asserted value is anchored to the IEEE 1815 field definitions above, not
// to the implementation's own output.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { dnp3 } from '../src/protocols/dnp3';

describe('DNP3 data-link header', () => {
  const registry = new ProtocolRegistry();
  registry.register(dnp3);

  // Reset Link States request, master(4) -> outstation(1).
  const frame = [0x05, 0x64, 0x05, 0xc0, 0x01, 0x00, 0x04, 0x00, 0x5b, 0xcf];

  const node = dissect(frame, 'dnp3', registry);
  const h = node.header;

  it('recognizes the 0x0564 sync word', () => {
    expect(h.get('start')).toBe(0x0564);
  });

  it('reads the length (counts CONTROL+DEST+SOURCE, here 5)', () => {
    expect(h.get('length')).toBe(5);
  });

  it('parses the control byte: DIR=1, PRM=1, FCB=0, FCV=0, FN=0', () => {
    const ctrl = h.get('control');
    expect(ctrl).toBe(0xc0);
    expect(ctrl & 0x80).toBe(0x80); // DIR=1 (master -> outstation)
    expect(ctrl & 0x40).toBe(0x40); // PRM=1 (primary)
    expect(ctrl & 0x20).toBe(0x00); // FCB=0
    expect(ctrl & 0x10).toBe(0x00); // FCV=0
    expect(ctrl & 0x0f).toBe(0x00); // FN=0 RESET_LINK_STATES
  });

  it('decodes the control byte as RESET_LINK_STATES', () => {
    const ctrlField = h.fields.find((f) => f.field.name === 'control')!;
    expect(ctrlField.meaning).toContain('RESET_LINK_STATES');
    expect(ctrlField.meaning).toContain('PRM=1');
    expect(ctrlField.meaning).toContain('master->outstation');
  });

  it('reads destination and source addresses little-endian', () => {
    expect(h.get('destination')).toBe(1); // 0x01 0x00 LE
    expect(h.get('source')).toBe(4); // 0x04 0x00 LE
  });

  it('has a fixed 10-byte header (8 link octets + 2-byte block CRC)', () => {
    expect(h.byteLength).toBe(10);
  });

  it('stops dissecting (no modeled child layer)', () => {
    expect(node.child).toBeNull();
  });

  it('consumes the whole frame as header, leaving no payload', () => {
    // This minimal frame is exactly the 10-byte header block; no user data follows.
    expect(node.payload.length).toBe(0);
  });
});
