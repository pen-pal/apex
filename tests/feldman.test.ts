import { describe, it, expect } from 'vitest';
import { commitments, share, verifyShare, reconstruct, G, P, Q } from '../src/web/feldman';
import { modpow } from '../src/web/blindsig';

describe('Feldman VSS — group setup', () => {
  it('g generates the order-q subgroup mod p', () => {
    expect(modpow(G, Q, P)).toBe(1);          // g^q = 1
    expect(modpow(G, 1, P)).not.toBe(1);       // order is not 1
  });
});

// Secret 7, polynomial f(x) = 7 + 3x mod 11 (threshold 2).
const COEFFS = [7, 3];

describe('shares and verification', () => {
  const C = commitments(COEFFS);
  it('commits to each coefficient as g^a_j', () => {
    expect(C).toEqual([modpow(G, 7, P), modpow(G, 3, P)]);
  });
  it('every honest share verifies against the commitments', () => {
    for (const i of [1, 2, 3, 4, 5]) {
      expect(verifyShare(i, share(COEFFS, i), C)).toBe(true);
    }
  });
  it('a tampered share is REJECTED — a cheating dealer is caught', () => {
    const good = share(COEFFS, 1);
    expect(verifyShare(1, (good + 1) % Q, C)).toBe(false);
  });
  it('a share from a DIFFERENT polynomial fails against these commitments', () => {
    const other = share([2, 9], 1); // different secret/coeffs
    expect(verifyShare(1, other, C)).toBe(false);
  });
});

describe('reconstruction (Shamir under the hood)', () => {
  it('any threshold-many shares recover the secret', () => {
    const s = (i: number) => ({ x: i, y: share(COEFFS, i) });
    expect(reconstruct([s(1), s(2)])).toBe(7);
    expect(reconstruct([s(2), s(4)])).toBe(7);
    expect(reconstruct([s(3), s(5)])).toBe(7);
  });
  it('one share alone reveals nothing (need ≥ threshold)', () => {
    // a single point is consistent with many secrets; reconstruct from one point just returns that point
    expect(reconstruct([{ x: 1, y: share(COEFFS, 1) }])).not.toBe(7);
  });

  it('works for a degree-2 (threshold-3) polynomial', () => {
    const c = [4, 9, 2]; // f(x) = 4 + 9x + 2x^2 mod 11
    const C = commitments(c);
    const pts = [1, 2, 3].map((i) => ({ x: i, y: share(c, i) }));
    expect(pts.every((p) => verifyShare(p.x, p.y, C))).toBe(true);
    expect(reconstruct(pts)).toBe(4);
    // two shares are NOT enough to pin a degree-2 polynomial
    expect(reconstruct(pts.slice(0, 2))).not.toBe(4);
  });
});
