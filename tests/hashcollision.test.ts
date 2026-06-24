import { describe, it, expect } from 'vitest';
import { sha1 } from '../src/web/sha1';
import { HASHES, birthday50, collisionProb } from '../src/web/hashfamily';

const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('SHA-1 — NIST vectors', () => {
  it('hashes the empty string and "abc"', () => {
    expect(toHex(sha1(new Uint8Array(0)))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(toHex(sha1(new TextEncoder().encode('abc')))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('handles a multi-block message (longer than 55 bytes)', () => {
    // SHA-1 of the 56-char NIST vector "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
    expect(toHex(sha1(new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))))
      .toBe('84983e441c3bd26ebaae4aa1f95129e5e54670f1');
  });
});

describe('hash family', () => {
  it('marks MD5 and SHA-1 broken, SHA-256/3 safe', () => {
    expect(HASHES.filter((h) => h.status === 'broken').map((h) => h.name)).toEqual(['MD5', 'SHA-1']);
    expect(HASHES.filter((h) => h.status === 'safe').map((h) => h.name)).toEqual(['SHA-256', 'SHA3-256']);
  });
  it('the ideal collision resistance is exactly half the output size', () => {
    for (const h of HASHES) expect(h.idealCollisionBits).toBe(h.bits / 2);
  });
  it('the best attack is at or below the birthday bound', () => {
    for (const h of HASHES) expect(h.bestAttackBits).toBeLessThanOrEqual(h.idealCollisionBits);
  });
});

describe('birthday bound', () => {
  it('50% collision needs ~2^(n/2) items, not 2^n', () => {
    expect(birthday50(32)).toBeCloseTo(1.1774 * 65536, 0); // ~77k for a 32-bit hash, not 4 billion
    expect(collisionProb(birthday50(32), 32)).toBeCloseTo(0.5, 1);
  });
  it('collision probability rises with more items', () => {
    expect(collisionProb(1000, 32)).toBeLessThan(collisionProb(100000, 32));
    expect(collisionProb(0, 64)).toBe(0);
  });
});
