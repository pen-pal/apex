import { describe, it, expect } from 'vitest';
import { CURVE, add, dbl, mul, order, allPoints, onCurve, subgroup, modinv, type Point } from '../src/web/ecc';

const P = (x: number, y: number): Point => ({ x, y });

describe('the toy curve y² = x³ + 2x + 2 mod 17 (Paar & Pelzl)', () => {
  it('the generator is on the curve', () => {
    expect(onCurve(CURVE.G, CURVE)).toBe(true);
  });

  it('doubling: 2G = (6, 3)', () => {
    expect(dbl(CURVE.G, CURVE)).toEqual(P(6, 3));
  });

  it('the documented multiples of G are reproduced', () => {
    // 1G..10G from the published worked example.
    const expected: [number, Point][] = [
      [1, P(5, 1)], [2, P(6, 3)], [3, P(10, 6)], [4, P(3, 1)], [5, P(9, 16)],
      [6, P(16, 13)], [7, P(0, 6)], [8, P(13, 7)], [9, P(7, 6)], [10, P(7, 11)],
    ];
    for (const [k, pt] of expected) expect(mul(k, CURVE.G, CURVE).point).toEqual(pt);
  });

  it('19·G = O (the group order is 19)', () => {
    expect(mul(19, CURVE.G, CURVE).point).toBeNull();
    expect(order(CURVE)).toBe(19);
  });

  it('has 18 affine points + O = order 19', () => {
    expect(allPoints(CURVE).length).toBe(18);
    expect(subgroup(CURVE).length).toBe(19); // indices 0..18, subgroup[0] = O
  });

  it('the group law is associative and commutative on sample points', () => {
    const A = mul(3, CURVE.G, CURVE).point;
    const B = mul(5, CURVE.G, CURVE).point;
    const C = mul(7, CURVE.G, CURVE).point;
    expect(add(A, B, CURVE)).toEqual(add(B, A, CURVE)); // commutative
    expect(add(add(A, B, CURVE), C, CURVE)).toEqual(add(A, add(B, C, CURVE), CURVE)); // associative
  });

  it('P + (−P) = O', () => {
    const A = mul(4, CURVE.G, CURVE).point!;
    expect(add(A, { x: A.x, y: (17 - A.y) % 17 }, CURVE)).toBeNull();
  });
});

describe('ECDH — both sides reach the same shared point', () => {
  it('a·(b·G) = b·(a·G) = (ab)·G', () => {
    const a = 6, b = 13;
    const A = mul(a, CURVE.G, CURVE).point; // Alice public
    const B = mul(b, CURVE.G, CURVE).point; // Bob public
    const sharedA = mul(a, B, CURVE).point; // Alice computes a·B
    const sharedB = mul(b, A, CURVE).point; // Bob computes b·A
    expect(sharedA).toEqual(sharedB);
    expect(sharedA).toEqual(mul(a * b, CURVE.G, CURVE).point);
  });
});

describe('modinv', () => {
  it('inverts in F_17', () => {
    expect(modinv(2, 17)).toBe(9); // 2·9 = 18 ≡ 1
    expect((modinv(5, 17) * 5) % 17).toBe(1);
  });
});
