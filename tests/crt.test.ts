import { describe, it, expect } from 'vitest';
import { reconstruct, preimages, pairwiseCoprime, reachable, product, lcm, gcd } from '../src/web/crt';

// Independent oracle: CRT reconstruction against the textbook example and the exhaustive definition of a bijection.
// Coprime moduli must give exactly one preimage for every fingerprint (a bijection over [0, M)); non-coprime moduli must
// break that — some fingerprints collide, some are impossible — and the count of reachable fingerprints is the lcm, not
// the product. Expected values are hand/number-theory facts, not the implementation's output.

describe('reconstruction (coprime case)', () => {
  it('the classic x ≡ 2(3), 3(5), 2(7) → 23', () => {
    expect(reconstruct([2, 3, 2], [3, 5, 7])).toBe(23);
  });
  it('round-trips: the reconstructed x leaves exactly the given remainders', () => {
    const mods = [3, 5, 7];
    for (const rs of [[0, 0, 0], [1, 4, 6], [2, 2, 2]]) {
      const x = reconstruct(rs, mods);
      expect(mods.map((m) => x % m)).toEqual(rs);
    }
  });
});

describe('coprime moduli give a bijection', () => {
  const mods = [3, 5, 7];
  it('is pairwise coprime and reaches all M fingerprints', () => {
    expect(pairwiseCoprime(mods)).toBe(true);
    expect(reachable(mods)).toBe(product(mods)); // lcm === product
  });
  it('every fingerprint has exactly one preimage', () => {
    for (let a = 0; a < 3; a++) for (let b = 0; b < 5; b++) for (let c = 0; c < 7; c++)
      expect(preimages([a, b, c], mods)).toHaveLength(1);
  });
});

describe('dropping coprimality breaks it', () => {
  const mods = [3, 6, 7]; // gcd(3,6)=3
  it('is not pairwise coprime; only lcm fingerprints are reachable, not the product', () => {
    expect(pairwiseCoprime(mods)).toBe(false);
    expect(reachable(mods)).toBe(42);        // lcm(3,6,7)
    expect(product(mods)).toBe(126);         // 3·6·7 — the map is 126/42 = 3-to-1
  });
  it('a consistent fingerprint now has three colliding preimages', () => {
    const p = preimages([0, 0, 0], mods);    // x ≡ 0 mod 3,6,7
    expect(p).toEqual([0, 42, 84]);          // three numbers, one fingerprint
  });
  it('an inconsistent fingerprint is impossible — zero preimages (a gap)', () => {
    // remainder 1 mod 6 forces remainder 1 mod 3, so asking for 0 mod 3 with 1 mod 6 can't be satisfied
    expect(preimages([0, 1, 0], mods)).toHaveLength(0);
  });
});

describe('helpers', () => {
  it('gcd and lcm', () => {
    expect(gcd(12, 18)).toBe(6);
    expect(lcm(4, 6)).toBe(12);
  });
});
