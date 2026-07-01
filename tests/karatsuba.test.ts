import { describe, it, expect } from 'vitest';
import { karatsuba, schoolbookMults } from '../src/web/karatsuba';

const nDigit = (n: number, seed: number): bigint => {
  let x = 0n; for (let i = 0; i < n; i++) x = x * 10n + BigInt(1 + ((i + seed) % 9)); return x;
};

describe('correctness', () => {
  it('multiplies a known pair', () => {
    expect(karatsuba(1234n, 5678n).product).toBe(1234n * 5678n);
  });
  it('the top level splits into exactly three sub-products (ac, bd, (a+b)(c+d))', () => {
    expect(karatsuba(1234n, 5678n).tree.children).toHaveLength(3);
  });
  it('agrees with true multiplication over 50000 random pairs (1–9 digit operands)', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 50000; t++) {
      const dx = 1 + rnd(9), dy = 1 + rnd(9);
      let x = 0n, y = 0n;
      for (let i = 0; i < dx; i++) x = x * 10n + BigInt(rnd(10));
      for (let i = 0; i < dy; i++) y = y * 10n + BigInt(rnd(10));
      expect(karatsuba(x, y).product).toBe(x * y);
    }
  });
});

describe('sub-quadratic scaling', () => {
  it('uses fewer single-digit multiplies than schoolbook, and the gap widens with size', () => {
    const ratios: number[] = [];
    for (const n of [8, 16, 32, 64]) {
      const x = nDigit(n, 0), y = nDigit(n, 3);
      const k = karatsuba(x, y);
      expect(k.product).toBe(x * y);
      expect(k.mults).toBeLessThan(schoolbookMults(x, y)); // beats n²
      ratios.push(schoolbookMults(x, y) / k.mults);
    }
    // advantage grows as n grows (n^1.585 vs n^2)
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]).toBeGreaterThan(ratios[i - 1]);
  });
});
