import { describe, it, expect } from 'vitest';
import { Montgomery, modInverse } from '../src/web/montgomery';

const bipow = (b: bigint, e: bigint, n: bigint): bigint => { let r = 1n; b %= n; while (e > 0n) { if (e & 1n) r = (r * b) % n; b = (b * b) % n; e >>= 1n; } return r; };

describe('setup', () => {
  it('rejects even/non-positive moduli; picks R = 2^k > n and n′ = -n⁻¹ mod R', () => {
    expect(() => new Montgomery(100n)).toThrow();
    const m = new Montgomery(97n);
    expect(m.R).toBe(128n);           // 2^7 > 97
    expect((97n * m.nPrime) % m.R).toBe(m.R - 1n); // n·n′ ≡ -1 (mod R)
  });
  it('modInverse is a true inverse', () => {
    expect((modInverse(97n, 128n) * 97n) % 128n).toBe(1n);
  });
});

describe('REDC and the round trip', () => {
  const m = new Montgomery(97n);
  it('REDC(T) = T·R⁻¹ mod n', () => {
    const Rinv = modInverse(m.R, 97n);
    for (let T = 0n; T < 97n * m.R; T += 777n) expect(m.redc(T)).toBe((T * Rinv) % 97n);
  });
  it('toMont then fromMont is the identity', () => {
    for (let a = 0n; a < 97n; a++) expect(m.fromMont(m.toMont(a))).toBe(a);
  });
});

describe('modular multiply and exponentiation match plain arithmetic', () => {
  it('mulMod equals (a·b) mod n exhaustively for n=97', () => {
    const m = new Montgomery(97n);
    for (let a = 0n; a < 97n; a++) for (let b = 0n; b < 97n; b++) expect(m.mulMod(a, b)).toBe((a * b) % 97n);
  });
  it('powMod equals modular exponentiation (incl. the RSA exponent 65537)', () => {
    for (const n of [97n, 251n, 1009n, 65537n]) {
      const m = new Montgomery(n);
      for (let t = 0; t < 200; t++) { const base = BigInt(t * 7 + 3) % n, exp = BigInt(t * 13 + 5); expect(m.powMod(base, exp)).toBe(bipow(base, exp, n)); }
    }
  });
  it('mulMod holds over 10000 random odd moduli', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 10000; t++) {
      const n = BigInt(3 + 2 * rnd(100000)); // odd
      const m = new Montgomery(n);
      const a = BigInt(rnd(1000000)), b = BigInt(rnd(1000000));
      expect(m.mulMod(a, b)).toBe((a * b) % n);
    }
  });
});
