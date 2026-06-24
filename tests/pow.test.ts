import { describe, it, expect } from 'vitest';
import { leadingZeroBits, mine, verify, expectedTries } from '../src/web/pow';

describe('leadingZeroBits', () => {
  it('counts leading zero bits across bytes', () => {
    expect(leadingZeroBits(Uint8Array.from([0xff]))).toBe(0);
    expect(leadingZeroBits(Uint8Array.from([0x80]))).toBe(0); // top bit set
    expect(leadingZeroBits(Uint8Array.from([0x40]))).toBe(1);
    expect(leadingZeroBits(Uint8Array.from([0x01]))).toBe(7);
    expect(leadingZeroBits(Uint8Array.from([0x00, 0x10]))).toBe(8 + 3);
    expect(leadingZeroBits(Uint8Array.from([0x00, 0x00]))).toBe(16);
  });
});

describe('mining proof of work', () => {
  it('finds a nonce whose real SHA-256 clears the difficulty', () => {
    const r = mine('Alice pays Bob 5 BTC', 12, 200_000);
    expect(r.found).toBe(true);
    expect(r.zeroBits).toBeGreaterThanOrEqual(12);
    expect(verify('Alice pays Bob 5 BTC', r.nonce, 12)).toBe(true); // independently verifiable
  });

  it('is deterministic (same data+difficulty → same nonce)', () => {
    const a = mine('block #1', 10, 100_000);
    const b = mine('block #1', 10, 100_000);
    expect(a.nonce).toBe(b.nonce);
    expect(a.found).toBe(true);
  });

  it('verify rejects a nonce that does not clear the target', () => {
    const r = mine('tx', 8, 100_000);
    expect(verify('tx', r.nonce, 8)).toBe(true);
    expect(verify('tx', r.nonce + 1, 8)).toBe(false); // a different nonce almost surely fails
    expect(verify('tx', r.nonce, 30)).toBe(false); // same nonce can't clear a far harder target
  });

  it('expected work doubles per difficulty bit', () => {
    expect(expectedTries(10)).toBe(1024);
    expect(expectedTries(20) / expectedTries(19)).toBe(2);
  });
});
