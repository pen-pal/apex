import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { bfd } from '../src/protocols/bfd';

// A hand-verified BFD Control packet in state Up, no authentication, built from
// RFC 5880 §4.1. This is the shape a real "BFD Up" control packet takes (the
// values match a standard 1-second-bring-up async session that has come Up):
//
// Byte 0: Vers(3)=1, Diag(5)=0 No Diagnostic         -> (1<<5)|0     = 0x20
// Byte 1: Sta(2)=3 Up, P=0 F=0 C=1 A=0 D=0 M=0        -> (3<<6)|0x08 = 0xC8
// Byte 2: Detect Mult = 3                              -> 0x03
// Byte 3: Length = 24 (no auth section)                -> 0x18
// Bytes 4-7:   My Discriminator   = 0x00000001
// Bytes 8-11:  Your Discriminator = 0x00000002
// Bytes 12-15: Desired Min TX Interval     = 1000000 us = 0x000F4240
// Bytes 16-19: Required Min RX Interval     = 1000000 us = 0x000F4240
// Bytes 20-23: Required Min Echo RX Interval = 0 (echo unsupported)
const bfdUp = [
  0x20, 0xc8, 0x03, 0x18,
  0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x02,
  0x00, 0x0f, 0x42, 0x40,
  0x00, 0x0f, 0x42, 0x40,
  0x00, 0x00, 0x00, 0x00,
];

describe('BFD dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(bfd);

  it('parses the fixed 24-byte mandatory section', () => {
    const node = dissect(bfdUp, 'bfd', reg);
    const h = node.header;
    expect(h.byteLength).toBe(24);
    expect(h.get('version')).toBe(1);
    expect(h.get('diagnostic')).toBe(0);
    expect(h.get('sessionState')).toBe(3); // Up
    expect(h.get('detectMultiplier')).toBe(3);
    expect(h.get('length')).toBe(24);
    expect(h.get('myDiscriminator')).toBe(0x00000001);
    expect(h.get('yourDiscriminator')).toBe(0x00000002);
    expect(h.get('desiredMinTxInterval')).toBe(1000000);
    expect(h.get('requiredMinRxInterval')).toBe(1000000);
    expect(h.get('requiredMinEchoRxInterval')).toBe(0);
  });

  it('decodes the enums and flags to their RFC 5880 meanings', () => {
    const node = dissect(bfdUp, 'bfd', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(f('sessionState').meaning).toBe('Up');
    expect(f('diagnostic').meaning).toBe('No Diagnostic');
    // Only the C (Control Plane Independent) bit is set in byte 1's flags.
    expect(f('flags').display).toContain('C');
    expect(f('flags').display).not.toContain('P');
    expect(f('flags').display).not.toContain('A');
    expect(f('myDiscriminator').display).toBe('0x00000001');
  });

  it('bounds the PDU by Length and stops dissecting (leaf protocol)', () => {
    // Append stray trailing bytes (e.g. IP/UDP padding). Length=24 must keep
    // them out of the payload, and there is no child to dissect.
    const node = dissect([...bfdUp, 0xde, 0xad, 0xbe, 0xef], 'bfd', reg);
    expect(node.payload.length).toBe(0);
    expect(node.trailer.length).toBe(4);
    expect(node.child).toBeNull();
    expect(bfd.next!(node.header, reg)).toBeNull();
  });
});
