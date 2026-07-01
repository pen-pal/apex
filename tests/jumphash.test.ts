import { describe, it, expect } from 'vitest';
import { jumpHash, hashKey, jumpHashStr, moduloHash, movedFraction } from '../src/web/jumphash';

const KEYS = Array.from({ length: 20000 }, (_, i) => hashKey('key' + i));

describe('output range and determinism', () => {
  it('always returns a bucket in [0, N)', () => {
    for (const n of [1, 2, 7, 10, 64]) for (const k of KEYS.slice(0, 200)) {
      const b = jumpHash(k, n);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(n);
    }
  });
  it('is deterministic', () => {
    expect(jumpHashStr('user42', 8)).toBe(jumpHashStr('user42', 8));
  });
});

describe('the distribution is nearly uniform', () => {
  it('every bucket gets ~equal share of keys', () => {
    const N = 10; const counts = new Array(N).fill(0);
    for (const k of KEYS) counts[jumpHash(k, N)]++;
    const ideal = KEYS.length / N;
    const maxDev = Math.max(...counts.map((c) => Math.abs(c - ideal) / ideal));
    expect(maxDev).toBeLessThan(0.08); // within ~8% of perfectly even
  });
});

describe('minimal disruption when the bucket count grows', () => {
  it('jump hash moves ~1/(N+1) of keys; modulo moves almost everything', () => {
    const jMoved = movedFraction(jumpHash, KEYS, 10);
    const mMoved = movedFraction(moduloHash, KEYS, 10);
    expect(jMoved).toBeGreaterThan(0.06);
    expect(jMoved).toBeLessThan(0.12);   // ≈ 1/11 = 0.091
    expect(mMoved).toBeGreaterThan(0.8);  // modulo reshuffles ~everything
  });
  it('THE invariant: a key that moves goes ONLY to the new bucket, never between existing ones', () => {
    let badMove = 0;
    for (const k of KEYS) {
      const a = jumpHash(k, 10), b = jumpHash(k, 11);
      if (a !== b && b !== 10) badMove++; // moved but not to the new bucket #10 → would be a violation
    }
    expect(badMove).toBe(0);
  });
  it('adding buckets never sends a key backwards to a lower existing bucket', () => {
    // check across several sizes: growing N only ever moves keys onto the newly added top bucket
    for (let n = 4; n < 9; n++) {
      for (const k of KEYS.slice(0, 3000)) {
        const a = jumpHash(k, n), b = jumpHash(k, n + 1);
        if (a !== b) expect(b).toBe(n); // the new bucket index
      }
    }
  });
});
