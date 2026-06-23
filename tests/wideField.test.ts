import { describe, it, expect } from 'vitest';
import { BitReader } from '../src/core/bits';
import { ipv6ToString, bytesToHex, formatValue } from '../src/core/format';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import type { ProtocolSpec } from '../src/core/types';

describe('wide fields (> 48 bits)', () => {
  it('reads whole bytes when byte-aligned', () => {
    const r = new BitReader([0x20, 0x01, 0x0d, 0xb8, 0xff]);
    r.readBits(8); // consume first byte
    expect(r.readBytes(3)).toEqual([0x01, 0x0d, 0xb8]);
  });

  it('formats IPv6 with :: compression (RFC 5952)', () => {
    const addr = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    expect(ipv6ToString(addr)).toBe('2001:db8::1');
    expect(ipv6ToString([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])).toBe('::1');
    expect(bytesToHex([0xde, 0xad])).toBe('de ad');
    expect(formatValue({ name: 'x', label: 'X', bits: 128, type: 'ipv6' }, 0, addr)).toBe('2001:db8::1');
  });

  it('dissects a 128-bit field into ParsedField.bytes', () => {
    const spec: ProtocolSpec = {
      id: 'wide', name: 'Wide', layer: 3, summary: 't',
      fields: [{ name: 'addr', label: 'Addr', bits: 128, type: 'ipv6' }],
    };
    const reg = new ProtocolRegistry();
    reg.register(spec);
    const bytes = [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    const node = dissect(bytes, 'wide', reg);
    const f = node.header.fields[0];
    expect(f.bytes).toEqual(bytes);
    expect(f.value).toBe(0);
    expect(f.display).toBe('2001:db8::1');
    expect(node.header.byteLength).toBe(16);
  });
});
