import { describe, it, expect } from 'vitest';
import {
  parityBit,
  internetChecksum,
  crc8Trace,
  hammingEncode,
  hammingDecode,
  luhn,
} from '../src/web/errordetect';
import { inetChecksum } from '../src/core/checksum';

describe('parityBit', () => {
  it('makes the total count of ones even (or odd)', () => {
    expect(parityBit(0b1011)).toBe(1); // three 1s → need one more for even
    expect(parityBit(0b1111)).toBe(0); // four 1s → already even
    expect(parityBit(0b1011, true)).toBe(0); // odd parity: three 1s is already odd
  });
});

describe('internetChecksum', () => {
  it('matches the engine primitive and folds carries (RFC 1071)', () => {
    const data = [0x00, 0x01, 0xf2, 0x03, 0xf4, 0xf5, 0xf6, 0xf7];
    const r = internetChecksum(data);
    expect(r.checksum).toBe(inetChecksum(data)); // cross-check vs the real engine
    expect(r.steps).toHaveLength(4); // one step per 16-bit word
  });
  it('a header plus its own checksum verifies to zero', () => {
    const hdr = [0x45, 0x00, 0x00, 0x3c, 0x1c, 0x46, 0x40, 0x00, 0x40, 0x06, 0x00, 0x00, 0xac, 0x10, 0x0a, 0x63, 0xac, 0x10, 0x0a, 0x0c];
    const ck = internetChecksum(hdr).checksum;
    const withCk = [...hdr];
    withCk[10] = ck >> 8; withCk[11] = ck & 0xff;
    expect(internetChecksum(withCk).checksum).toBe(0); // valid header re-sums to 0
  });
});

describe('crc8Trace', () => {
  it('matches the published CRC-8 check value (0xF4 for "123456789")', () => {
    const msg = [...new TextEncoder().encode('123456789')];
    const r = crc8Trace(msg);
    expect(r.remainder).toBe(0xf4); // canonical CRC-8/SMBUS check value, poly 0x07
    expect(r.steps).toHaveLength(msg.length * 8); // 8 clock cycles per byte
    expect(crc8Trace(msg).remainder).toBe(r.remainder); // deterministic
  });
});

describe('hamming(7,4)', () => {
  it('corrects ANY single-bit error for ALL 16 data words', () => {
    for (let n = 0; n < 16; n++) {
      const data = [(n >> 3) & 1, (n >> 2) & 1, (n >> 1) & 1, n & 1];
      const enc = hammingEncode(data);
      // clean decode recovers the data, syndrome 0
      const clean = hammingDecode(enc.code);
      expect(clean.syndrome).toBe(0);
      expect(clean.data).toEqual(data);
      // flip each of the 7 positions in turn → all corrected
      for (let pos = 0; pos < 7; pos++) {
        const noisy = enc.code.slice();
        noisy[pos] ^= 1;
        const dec = hammingDecode(noisy);
        expect(dec.errorPos).toBe(pos + 1); // syndrome points at the culprit
        expect(dec.data).toEqual(data); // data still recovered
      }
    }
  });
});

describe('luhn', () => {
  it('accepts a valid PAN and rejects a typo', () => {
    expect(luhn('4539 1488 0343 6467')!.valid).toBe(true); // valid test Visa
    expect(luhn('4539 1488 0343 6476')!.valid).toBe(false); // last two swapped
    expect(luhn('79927398713')!.valid).toBe(true); // Wikipedia canonical example
    expect(luhn('hello')).toBeNull();
  });
});
