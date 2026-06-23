import { describe, it, expect } from 'vitest';
import {
  varintEncode, varintDecode, zigzagEncode, zigzagDecode,
  derParse, punycodeEncode, punycodeDecode, toAscii, percentEncode, hexdump,
} from '../src/web/encoding2';

describe('protobuf varint', () => {
  it('matches the spec examples', () => {
    expect(varintEncode(1)).toEqual([0x01]);
    expect(varintEncode(150)).toEqual([0x96, 0x01]); // the canonical protobuf example
    expect(varintEncode(300)).toEqual([0xac, 0x02]);
    expect(varintDecode([0x96, 0x01]).value).toBe(150n);
    expect(varintDecode([0xac, 0x02])).toEqual({ value: 300n, bytesRead: 2 });
  });
});

describe('ZigZag', () => {
  it('maps signed to unsigned per the spec table', () => {
    expect(zigzagEncode(0n)).toBe(0n);
    expect(zigzagEncode(-1n)).toBe(1n);
    expect(zigzagEncode(1n)).toBe(2n);
    expect(zigzagEncode(-2n)).toBe(3n);
    expect(zigzagEncode(2147483647n)).toBe(4294967294n);
    expect(zigzagEncode(-2147483648n)).toBe(4294967295n);
    for (const n of [0n, -1n, 1n, -500n, 123456789n]) expect(zigzagDecode(zigzagEncode(n))).toBe(n);
  });
});

describe('ASN.1 / DER', () => {
  it('parses a nested SEQUENCE of INTEGERs', () => {
    // SEQUENCE { INTEGER 1, INTEGER 2 }
    const der = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]);
    const t = derParse(der);
    expect(t.tagName).toBe('SEQUENCE');
    expect(t.constructed).toBe(true);
    expect(t.length).toBe(6);
    expect(t.children).toHaveLength(2);
    expect(t.children![0].tagName).toBe('INTEGER');
    expect([...t.children![0].value]).toEqual([1]);
    expect([...t.children![1].value]).toEqual([2]);
  });
  it('handles long-form lengths', () => {
    // OCTET STRING of 200 bytes → length encoded as 0x81 0xC8
    const body = new Uint8Array(200).fill(0xaa);
    const der = new Uint8Array([0x04, 0x81, 0xc8, ...body]);
    const t = derParse(der);
    expect(t.tagName).toBe('OCTET STRING');
    expect(t.length).toBe(200);
    expect(t.headerLen).toBe(3);
  });
});

describe('punycode (RFC 3492)', () => {
  it('encodes/decodes the canonical examples', () => {
    expect(punycodeEncode('münchen')).toBe('mnchen-3ya');
    expect(punycodeDecode('mnchen-3ya')).toBe('münchen');
    expect(punycodeEncode('bücher')).toBe('bcher-kva');
    expect(punycodeDecode('bcher-kva')).toBe('bücher');
  });
  it('exposes the IDN homograph trap', () => {
    // "аррӏе" with Cyrillic look-alikes is NOT apple.com
    const spoof = toAscii('xn--80ak6aa92e.com'.startsWith('xn--') ? 'аррӏе.com' : 'аррӏе.com');
    expect(spoof.startsWith('xn--')).toBe(true);
    expect(spoof).not.toBe('apple.com');
    expect(toAscii('apple.com')).toBe('apple.com'); // pure ASCII unchanged
  });
});

describe('percent-encoding (RFC 3986)', () => {
  it('encodes reserved bytes via UTF-8', () => {
    expect(percentEncode('a b')).toBe('a%20b');
    expect(percentEncode('café')).toBe('caf%C3%A9');
    expect(percentEncode('A-_.~')).toBe('A-_.~'); // unreserved set untouched
  });
});

describe('hexdump', () => {
  it('produces offset / hex / ascii lines', () => {
    const lines = hexdump(new TextEncoder().encode('Hello, world!'));
    expect(lines[0]).toMatch(/^00000000 {2}48 65 6c 6c 6f 2c 20 77 {2}6f/); // gap after byte 8
    expect(lines[0]).toContain('|Hello, world!|');
  });
});
