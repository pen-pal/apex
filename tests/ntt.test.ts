import { describe, it, expect } from 'vitest';
import { ntt, intt, pointwise, negamul, nttMul, modpow, mod, TOY } from '../src/web/ntt';

const { q, psi } = TOY;

describe('toy parameters are valid for a negacyclic NTT (n=8, q=17, ψ=3)', () => {
  it('ψ is a primitive 2n-th root of unity: ψ^n ≡ −1, ψ^(2n) ≡ 1', () => {
    expect(modpow(psi, 8, q)).toBe(mod(-1, q)); // ψ^8 = 16 = −1
    expect(modpow(psi, 16, q)).toBe(1);
    expect(modpow(psi, 4, q)).not.toBe(mod(-1, q)); // genuinely order 16
  });
});

describe('the NTT round-trips', () => {
  it('INTT(NTT(a)) == a', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(intt(ntt(a, q, psi), q, psi)).toEqual(a.map((x) => mod(x, q)));
  });
});

describe('the core identity: pointwise product in the transform domain == convolution', () => {
  it('INTT(NTT(a) ∘ NTT(b)) equals the schoolbook negacyclic product', () => {
    const a = [1, 2, 3, 4, 0, 0, 0, 0];
    const b = [5, 6, 7, 0, 0, 0, 0, 0];
    const viaNtt = intt(pointwise(ntt(a, q, psi), ntt(b, q, psi), q), q, psi);
    expect(viaNtt).toEqual(negamul(a, b, q));
  });

  it('multiplying by the constant polynomial 1 is the identity', () => {
    const a = [3, 1, 4, 1, 5, 9, 2, 6].map((x) => mod(x, q));
    const one = [1, 0, 0, 0, 0, 0, 0, 0];
    expect(nttMul(a, one, q, psi)).toEqual(a);
  });

  it('multiplying by x shifts coefficients and negates the wrap (x^n = −1)', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    const x = [0, 1, 0, 0, 0, 0, 0, 0];
    // x·a mod (x^8+1): c_k = a_{k-1}, and c_0 = −a_7
    expect(nttMul(a, x, q, psi)).toEqual([mod(-8, q), 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('NTT path agrees with schoolbook for random-ish inputs', () => {
  it('several vectors all match negamul', () => {
    const cases: [number[], number[]][] = [
      [[2, 0, 1, 0, 3, 0, 0, 0], [0, 4, 0, 5, 0, 0, 0, 0]],
      [[16, 16, 16, 16, 16, 16, 16, 16], [1, 1, 1, 1, 1, 1, 1, 1]],
      [[7, 7, 0, 0, 0, 0, 0, 0], [7, 0, 0, 0, 0, 0, 0, 7]],
    ];
    for (const [a, b] of cases) expect(nttMul(a, b, q, psi)).toEqual(negamul(a, b, q));
  });
});
