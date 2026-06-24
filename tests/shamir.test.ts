import { describe, it, expect } from 'vitest';
import { split, reconstruct, modinv, P, type Share } from '../src/web/shamir';

const SECRET = 123;
const shares = split(SECRET, 5, 3, [166, 94]); // fixed coeffs → deterministic

describe('GF(257) arithmetic', () => {
  it('modular inverse', () => {
    expect((modinv(2) * 2) % P).toBe(1);
    expect((modinv(200) * 200) % P).toBe(1);
  });
});

describe('Shamir split / reconstruct', () => {
  it('produces n distinct shares at x = 1..n', () => {
    expect(shares).toHaveLength(5);
    expect(shares.map((s) => s.x)).toEqual([1, 2, 3, 4, 5]);
  });

  it('any k=3 shares reconstruct the secret', () => {
    const subsets = [[0, 1, 2], [0, 2, 4], [1, 3, 4], [2, 3, 4]];
    for (const idx of subsets) {
      const pick = idx.map((i) => shares[i]);
      expect(reconstruct(pick)).toBe(SECRET);
    }
  });

  it('more than k shares still reconstruct correctly', () => {
    expect(reconstruct(shares)).toBe(SECRET); // all 5
    expect(reconstruct(shares.slice(0, 4))).toBe(SECRET);
  });

  it('k−1 shares do NOT reveal the secret (under-determined)', () => {
    // With only 2 of the 3 needed, treating them as a line through (0,?) gives some
    // value, but it is not the secret — every secret remains possible.
    const two: Share[] = [shares[0], shares[1]];
    expect(reconstruct(two)).not.toBe(SECRET);
  });

  it('the secret is recoverable for any byte value', () => {
    for (const s of [0, 1, 42, 200, 255]) {
      const sh = split(s, 4, 2, [77]);
      expect(reconstruct([sh[0], sh[3]])).toBe(s);
    }
  });
});
