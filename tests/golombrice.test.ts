import { describe, it, expect } from 'vitest';
import { encode, decode, codeLength, bestK } from '../src/web/golombrice';

describe('Golomb-Rice encoding (M = 2^k)', () => {
  it('canonical codes for k=2', () => {
    expect(encode(0, 2)).toBe('000');     // q0 r0 → "0"+"00"
    expect(encode(1, 2)).toBe('001');
    expect(encode(3, 2)).toBe('011');     // largest with q=0
    expect(encode(4, 2)).toBe('1000');    // q1 r0 → "10"+"00"
    expect(encode(5, 2)).toBe('1001');
    expect(encode(10, 2)).toBe('11010');  // q2 r2 → "110"+"10"
  });
  it('k=0 is pure unary', () => {
    expect(encode(0, 0)).toBe('0');
    expect(encode(3, 0)).toBe('1110');
  });
  it('code length = quotient + 1 + k', () => {
    for (const [n, k] of [[5, 2], [10, 2], [0, 0], [255, 4], [1000, 3]] as const) {
      expect(encode(n, k).length).toBe(codeLength(n, k));
    }
  });
});

describe('decoding round-trips', () => {
  it('decode inverts encode across values and k', () => {
    for (let n = 0; n < 300; n++) {
      for (const k of [0, 1, 2, 4, 8]) {
        const bits = encode(n, k);
        expect(decode(bits, k)).toEqual({ value: n, bitsRead: bits.length });
      }
    }
  });
  it('decodes back-to-back codes from a stream', () => {
    const stream = encode(5, 2) + encode(0, 2) + encode(9, 2);
    let off = 0;
    const out: number[] = [];
    for (let i = 0; i < 3; i++) { const d = decode(stream, 2, off); out.push(d.value); off += d.bitsRead; }
    expect(out).toEqual([5, 0, 9]);
  });
  it('throws on a truncated code', () => {
    expect(() => decode('111', 2)).toThrow();       // unary never terminates
    expect(() => decode('100', 2)).toThrow();       // remainder cut short
  });
});

describe('choosing the parameter k', () => {
  it('small, tightly-clustered values prefer a small k', () => {
    expect(bestK([0, 1, 0, 2, 1, 0, 1]).k).toBeLessThanOrEqual(1);
  });
  it('larger values prefer a larger k (unary would explode)', () => {
    const big = bestK([200, 210, 190, 205, 195]);
    expect(big.k).toBeGreaterThan(4);
    // and the chosen k must beat k=0 by a lot
    expect(big.bits).toBeLessThan([200, 210, 190, 205, 195].reduce((s, v) => s + codeLength(v, 0), 0));
  });
  it('the reported bits equal the actual encoded length at that k', () => {
    const vals = [3, 7, 1, 9, 4, 2];
    const { k, bits } = bestK(vals);
    expect(bits).toBe(vals.reduce((s, v) => s + encode(v, k).length, 0));
  });
});
