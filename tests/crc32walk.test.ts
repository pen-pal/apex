import { describe, it, expect } from 'vitest';
import { crc32, crc32Trace, byteBitSteps, strBytes, toHex32 } from '../src/web/crc32walk';

describe('CRC-32 against published check values', () => {
  it('the canonical CRC32("123456789") = 0xCBF43926', () => {
    expect(toHex32(crc32(strBytes('123456789')))).toBe('cbf43926');
  });
  it('CRC32("") = 0 and CRC32("a") = 0xE8B7BE43', () => {
    expect(crc32([])).toBe(0);
    expect(toHex32(crc32(strBytes('a')))).toBe('e8b7be43');
  });
  it('CRC32 of "The quick brown fox jumps over the lazy dog" = 0x414FA339', () => {
    expect(toHex32(crc32(strBytes('The quick brown fox jumps over the lazy dog')))).toBe('414fa339');
  });
});

describe('error detection', () => {
  it('a single flipped bit changes the CRC', () => {
    const a = crc32(strBytes('hello'));
    const corrupt = strBytes('hello'); corrupt[0] ^= 0x01; // flip one bit
    expect(crc32(corrupt)).not.toBe(a);
  });
});

describe('the shift-register walk', () => {
  it('records one register state per input byte and matches the final CRC', () => {
    const t = crc32Trace(strBytes('123456789'));
    expect(t.bytes).toHaveLength(9);
    // final CRC is the last register XOR 0xFFFFFFFF
    expect((t.bytes[8].reg ^ 0xffffffff) >>> 0).toBe(t.crc);
  });

  it('byteBitSteps performs exactly 8 shifts and XORs the poly only when the LSB was set', () => {
    const steps = byteBitSteps(0xffffffff, '1'.charCodeAt(0));
    expect(steps).toHaveLength(8);
    // reproduce the loop independently and compare the final register
    let crc = (0xffffffff ^ '1'.charCodeAt(0)) >>> 0;
    for (let i = 0; i < 8; i++) crc = (crc & 1) ? ((crc >>> 1) ^ 0xedb88320) >>> 0 : crc >>> 1;
    expect(steps[7].reg).toBe(crc >>> 0);
  });
});
