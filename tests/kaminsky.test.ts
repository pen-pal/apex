import { describe, it, expect } from 'vitest';
import { entropyBits, perAttemptOdds, expectedAttempts, timeToPoison } from '../src/web/kaminsky';

describe('entropy the attacker must guess', () => {
  it('query ID alone is only 16 bits (the pre-2008 world)', () => {
    const bits = entropyBits({ portRandom: false, case0x20Letters: 0, dnssec: false });
    expect(bits).toBe(16);
    expect(expectedAttempts(bits)).toBe(65536);
    expect(perAttemptOdds(bits)).toBeCloseTo(1 / 65536, 12);
  });
  it('source-port randomization adds 16 bits → 32 (the RFC 5452 fix)', () => {
    expect(entropyBits({ portRandom: true, case0x20Letters: 0, dnssec: false })).toBe(32);
    expect(expectedAttempts(32)).toBe(2 ** 32); // ~4.3 billion packets
  });
  it('0x20 case randomization adds one bit per case-flippable letter', () => {
    expect(entropyBits({ portRandom: true, case0x20Letters: 8, dnssec: false })).toBe(40);
  });
  it('DNSSEC makes forgery infeasible regardless of guessing', () => {
    const bits = entropyBits({ portRandom: false, case0x20Letters: 0, dnssec: true });
    expect(bits).toBe(Infinity);
    expect(perAttemptOdds(bits)).toBe(0);
    expect(expectedAttempts(bits)).toBe(Infinity);
  });
});

describe('time to poison — why entropy matters', () => {
  it('16 bits falls in a blink; 32 bits is impractically long at the same rate', () => {
    const rate = 100_000; // forged packets/sec
    const weak = timeToPoison(16, rate);
    const strong = timeToPoison(32, rate);
    expect(weak).toBeCloseTo(65536 / rate, 6);       // < 1 second
    expect(weak).toBeLessThan(1);
    expect(strong).toBeGreaterThan(weak * 60000);    // ~12 hours vs sub-second — a 65536× jump
  });
  it('the Kaminsky trick means every packet is a live attempt (no TTL lockout)', () => {
    // modeled simply as: expected time = expectedAttempts / packetsPerSec, no per-record cap
    expect(timeToPoison(16, 50_000)).toBeCloseTo(65536 / 50_000, 6);
  });
  it('DNSSEC → never', () => {
    expect(timeToPoison(Infinity, 1e9)).toBe(Infinity);
    expect(timeToPoison(16, 0)).toBe(Infinity); // no packets, no poison
  });
});
