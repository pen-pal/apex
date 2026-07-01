import { describe, it, expect } from 'vitest';
import { alu } from '../src/web/alu';

describe('ALU operations', () => {
  it('computes each op correctly on 8-bit inputs', () => {
    expect(alu(100, 50, 'ADD').result).toBe(150);
    expect(alu(50, 80, 'SUB').result).toBe((50 - 80) & 0xff); // 226, two's complement
    expect(alu(0xf0, 0x3c, 'AND').result).toBe(0x30);
    expect(alu(0xf0, 0x0f, 'OR').result).toBe(0xff);
    expect(alu(0xff, 0x0f, 'XOR').result).toBe(0xf0);
    expect(alu(1, 4, 'SHL').result).toBe(16);
    expect(alu(0x80, 2, 'SHR').result).toBe(0x20);
  });
  it('SLT is signed set-less-than', () => {
    expect(alu(0xff, 1, 'SLT').result).toBe(1); // -1 < 1
    expect(alu(5, 3, 'SLT').result).toBe(0);
    expect(alu(0x80, 0x7f, 'SLT').result).toBe(1); // -128 < 127
  });
});

describe('flags (Z / N / C / V)', () => {
  it('zero and negative', () => {
    expect(alu(50, 50, 'SUB').zero).toBe(1);
    expect(alu(100, 50, 'ADD').zero).toBe(0);
    expect(alu(50, 80, 'SUB').negative).toBe(1); // result 226 has top bit set
  });
  it('carry is unsigned overflow / borrow', () => {
    expect(alu(200, 100, 'ADD').carry).toBe(1);   // 300 > 255
    expect(alu(100, 50, 'ADD').carry).toBe(0);
  });
  it('overflow is signed overflow (same-sign inputs, different-sign result)', () => {
    expect(alu(100, 50, 'ADD').overflow).toBe(1); // 150 wraps past +127
    expect(alu(100, 20, 'ADD').overflow).toBe(0); // 120 fits
    expect(alu(0x80, 0x80, 'ADD').overflow).toBe(1); // -128 + -128
  });
});

describe('agrees with reference operators over 50000 random pairs', () => {
  it('all ops and the carry/SLT flags', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const m = 0xff;
    for (let i = 0; i < 50000; i++) {
      const a = rnd(256), b = rnd(256);
      expect(alu(a, b, 'ADD').result).toBe((a + b) & m);
      expect(alu(a, b, 'SUB').result).toBe((a - b) & m);
      expect(alu(a, b, 'AND').result).toBe(a & b);
      expect(alu(a, b, 'OR').result).toBe(a | b);
      expect(alu(a, b, 'XOR').result).toBe(a ^ b);
      expect(alu(a, b, 'SHL').result).toBe((a << (b & 7)) & m);
      expect(alu(a, b, 'SHR').result).toBe(a >>> (b & 7));
      expect(alu(a, b, 'ADD').carry).toBe(((a + b) >> 8) & 1);
      const sa = a > 127 ? a - 256 : a, sb = b > 127 ? b - 256 : b;
      expect(alu(a, b, 'SLT').result).toBe(sa < sb ? 1 : 0);
    }
  });
});
