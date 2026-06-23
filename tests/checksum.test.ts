import { describe, it, expect } from 'vitest';
import { crc32, inetChecksum } from '../src/core/checksum';

describe('checksum primitives', () => {
  it('CRC-32 matches the standard "123456789" vector', () => {
    const bytes = [...'123456789'].map((c) => c.charCodeAt(0));
    expect(crc32(bytes)).toBe(0xcbf43926);
  });

  it('internet checksum matches the RFC 1071 worked example', () => {
    expect(inetChecksum([0x00, 0x01, 0xf2, 0x03, 0xf4, 0xf5, 0xf6, 0xf7])).toBe(0x220d);
  });

  it('a header with its correct checksum embedded sums to zero', () => {
    const hdr = [0x45, 0x00, 0x00, 0x3c, 0x43, 0x21, 0x40, 0x00, 0x40, 0x06, 0x00, 0x00, 192, 168, 1, 42, 142, 250, 72, 14];
    const ck = inetChecksum(hdr);
    hdr[10] = (ck >> 8) & 255; hdr[11] = ck & 255;
    expect(inetChecksum(hdr)).toBe(0);
  });
});
