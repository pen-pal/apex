import { describe, it, expect } from 'vitest';
import { MAGIC, bitsOf, floatOf, fields, fastInvSqrt } from '../src/web/fastinvsqrt';

describe('the pieces', () => {
  it('uses the Quake III magic constant', () => {
    expect(MAGIC).toBe(0x5f3759df);
  });
  it('reinterprets bits both ways (float32 round-trip)', () => {
    expect(floatOf(bitsOf(1.0))).toBe(1.0);
    expect(floatOf(bitsOf(0.5))).toBe(0.5);
    expect(bitsOf(1.0)).toBe(0x3f800000); // 1.0f = exponent 127, mantissa 0
  });
  it('decodes IEEE-754 fields', () => {
    expect(fields(1.0)).toMatchObject({ sign: 0, exponent: 127, mantissa: 0 }); // bias 127
    expect(fields(2.0)).toMatchObject({ sign: 0, exponent: 128, mantissa: 0 });
  });
});

describe('it actually computes 1/sqrt(x)', () => {
  it('the classic x=1 → ~0.998 after one Newton step', () => {
    const r = fastInvSqrt(1, 1);
    expect(r.guess).toBeCloseTo(0.9662, 3); // the raw bit-hack guess
    expect(r.refined).toBeCloseTo(0.99831, 4);
    expect(r.trueValue).toBe(1);
  });
  it('matches a few known values', () => {
    expect(fastInvSqrt(4, 1).refined).toBeCloseTo(0.5, 2);
    expect(fastInvSqrt(0.25, 1).refined).toBeCloseTo(2, 2);
    expect(fastInvSqrt(100, 1).refined).toBeCloseTo(0.1, 3);
  });
});

describe('convergence matches the published error bounds', () => {
  it('bit hack ~3.4%, +1 Newton ~0.17%, +2 Newton ~0.0005% (max over a wide range)', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s / 0x80000000) * n; };
    let maxGuess = 0, max1 = 0, max2 = 0;
    for (let t = 0; t < 100000; t++) {
      const x = 0.001 + rnd(10000);
      const trueV = 1 / Math.sqrt(x);
      maxGuess = Math.max(maxGuess, Math.abs(fastInvSqrt(x, 0).guess - trueV) / trueV);
      max1 = Math.max(max1, fastInvSqrt(x, 1).relError);
      max2 = Math.max(max2, fastInvSqrt(x, 2).relError);
    }
    expect(maxGuess).toBeLessThan(0.035);   // the raw hack: within ~3.4%
    expect(maxGuess).toBeGreaterThan(0.02); // ...but genuinely rough (not already precise)
    expect(max1).toBeLessThan(0.002);       // one Newton step: within ~0.17%
    expect(max2).toBeLessThan(0.00001);     // two: within ~0.0005%
    expect(max2).toBeLessThan(max1);        // each iteration ~squares the precision
  });
});
