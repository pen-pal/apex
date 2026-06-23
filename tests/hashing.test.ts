import { describe, it, expect } from 'vitest';
import { sha256, hmacSha256, bitDifference, toHex, flipBit } from '../src/web/hashing';

const enc = (s: string) => new TextEncoder().encode(s);

describe('sha256', () => {
  it('matches the FIPS 180-4 published vectors', async () => {
    // SHA-256("abc")
    expect(toHex(await sha256(enc('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    // SHA-256("") — the empty string
    expect(toHex(await sha256(enc('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('hmacSha256', () => {
  it('matches RFC 4231 test case 1', async () => {
    const key = new Uint8Array(20).fill(0x0b);
    const mac = await hmacSha256(key, enc('Hi There'));
    expect(toHex(mac)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });
});

describe('bitDifference / avalanche', () => {
  it('counts differing bits exactly', () => {
    expect(bitDifference(new Uint8Array([0x00]), new Uint8Array([0xff]))).toBe(8);
    expect(bitDifference(new Uint8Array([0b1010]), new Uint8Array([0b0011]))).toBe(2);
  });
  it('a one-bit input change avalanches ~half of SHA-256 output', async () => {
    const a = await sha256(enc('abc'));
    const b = await sha256(flipBit(enc('abc'), 0, 0)); // flip one input bit
    const diff = bitDifference(a, b);
    // 256-bit digest; a strong hash flips close to half. Allow a generous band.
    expect(diff).toBeGreaterThan(96);
    expect(diff).toBeLessThan(160);
  });
});

describe('flipBit', () => {
  it('flips exactly one bit, MSB-first, without mutating the input', () => {
    const src = new Uint8Array([0b00000000]);
    const out = flipBit(src, 0, 0);
    expect(out[0]).toBe(0b10000000);
    expect(src[0]).toBe(0); // original untouched
    expect(flipBit(new Uint8Array([0xff]), 0, 7)[0]).toBe(0xfe);
  });
});
