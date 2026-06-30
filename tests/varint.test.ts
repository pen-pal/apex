import { describe, it, expect } from 'vitest';
import { encodeVarint, decodeVarint, zigzagEncode, zigzagDecode, encodeVarintSigned64 } from '../src/web/varint';

describe('unsigned varint (LEB128) — canonical vectors', () => {
  it('matches the Protocol Buffers examples', () => {
    expect(encodeVarint(0)).toEqual([0x00]);
    expect(encodeVarint(1)).toEqual([0x01]);
    expect(encodeVarint(127)).toEqual([0x7f]);   // largest single-byte
    expect(encodeVarint(128)).toEqual([0x80, 0x01]);
    expect(encodeVarint(300)).toEqual([0xac, 0x02]); // the spec's worked example
    expect(encodeVarint(16383)).toEqual([0xff, 0x7f]);
    expect(encodeVarint(16384)).toEqual([0x80, 0x80, 0x01]);
  });
  it('round-trips and reports bytes read', () => {
    for (const n of [0, 1, 127, 128, 300, 16384, 1_000_000, 2 ** 40]) {
      const enc = encodeVarint(n);
      expect(decodeVarint(enc)).toEqual({ value: n, bytesRead: enc.length });
    }
  });
  it('decodes from an offset within a buffer (back-to-back fields)', () => {
    const buf = [...encodeVarint(300), ...encodeVarint(5)];
    expect(decodeVarint(buf, 0)).toEqual({ value: 300, bytesRead: 2 });
    expect(decodeVarint(buf, 2)).toEqual({ value: 5, bytesRead: 1 });
  });
  it('byte width grows one byte per 7 bits of magnitude', () => {
    expect(encodeVarint(127).length).toBe(1);
    expect(encodeVarint(128).length).toBe(2);
    expect(encodeVarint(16383).length).toBe(2);
    expect(encodeVarint(16384).length).toBe(3);
  });
  it('rejects negatives and truncated input', () => {
    expect(() => encodeVarint(-1)).toThrow();
    expect(() => decodeVarint([0x80, 0x80])).toThrow(); // continuation bit never cleared
  });
});

describe('zigzag signed mapping', () => {
  it('interleaves signs so small magnitudes stay small', () => {
    expect([0, -1, 1, -2, 2, -3].map(zigzagEncode)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('round-trips', () => {
    for (const n of [0, -1, 1, -2, 2, 63, -64, 1000, -1000, 2 ** 30, -(2 ** 30)]) {
      expect(zigzagDecode(zigzagEncode(n))).toBe(n);
    }
  });
});

describe('the negative-number gotcha', () => {
  it('a plain signed varint of -1 is the full 10 bytes', () => {
    const enc = encodeVarintSigned64(-1);
    expect(enc.length).toBe(10);
    expect(enc).toEqual([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01]);
  });
  it('zigzag makes the same -1 a single byte', () => {
    expect(encodeVarint(zigzagEncode(-1))).toEqual([0x01]); // 10 bytes → 1 byte
  });
  it('small negatives are cheap via zigzag, expensive plain', () => {
    expect(encodeVarintSigned64(-2).length).toBe(10);
    expect(encodeVarint(zigzagEncode(-2)).length).toBe(1);
  });
});
