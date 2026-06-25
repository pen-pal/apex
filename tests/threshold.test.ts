import { describe, it, expect } from 'vitest';
import { deal, reconstruct, lagrange0, sign, verify, challenge, scalarMul, N } from '../src/web/threshold';

// 2-of-3 over the toy curve (order 19). secret x=7, polynomial f(X)=7+3X mod 19 → shares f(1)=10,f(2)=13,f(3)=16.
const SECRET = 7;
const d = deal(SECRET, 2, 3, [3]);

describe('Shamir sharing of the signing key', () => {
  it('produces n shares of a degree-(t−1) polynomial with f(0)=secret', () => {
    expect(d.shares).toEqual([{ id: 1, value: 10 }, { id: 2, value: 13 }, { id: 3, value: 16 }]);
    expect(d.coeffs[0]).toBe(7); // f(0) = the secret
  });
  it('the group public key is secret·G (the key the world verifies against)', () => {
    expect(d.pub).toEqual(scalarMul(SECRET));
  });
  it('ANY t shares Lagrange-reconstruct the secret; the choice of t does not matter', () => {
    expect(reconstruct([d.shares[0], d.shares[1]])).toBe(7); // {1,2}
    expect(reconstruct([d.shares[0], d.shares[2]])).toBe(7); // {1,3}
    expect(reconstruct([d.shares[1], d.shares[2]])).toBe(7); // {2,3}
  });
  it('t−1 shares reconstruct to the WRONG value (they reveal nothing about the secret)', () => {
    expect(reconstruct([d.shares[0]])).not.toBe(7); // one share alone → just its own value
  });
});

describe('threshold Schnorr signing — the key is never assembled', () => {
  it('a t-of-n coalition produces a signature that verifies under the group key', () => {
    const sig = sign([d.shares[0], d.shares[1]], [4, 9], d.pub, 'transfer 100');
    expect(verify(sig, d.pub, 'transfer 100')).toBe(true);
  });
  it('a DIFFERENT coalition signs the same message just as validly (same group key)', () => {
    const a = sign([d.shares[0], d.shares[1]], [4, 9], d.pub, 'hi');
    const b = sign([d.shares[1], d.shares[2]], [2, 5], d.pub, 'hi');
    expect(verify(a, d.pub, 'hi')).toBe(true);
    expect(verify(b, d.pub, 'hi')).toBe(true);
  });
  it('a t−1 coalition CANNOT forge a valid signature', () => {
    // one party uses the right Lagrange machinery but the wrong (size-1) coalition → wrong combined key
    const sig = sign([d.shares[0]], [4], d.pub, 'steal');
    expect(verify(sig, d.pub, 'steal')).toBe(false);
  });
  it('a tampered message fails verification (the challenge binds R, Y and m)', () => {
    const sig = sign([d.shares[0], d.shares[1]], [4, 9], d.pub, 'pay alice');
    // the toy challenge has only N−1 values, so pick a tamper that genuinely changes c (a real hash always would)
    const tampered = ['pay bob', 'pay carol', 'send 999', 'PAY ALICE', 'noop'].find((m) => challenge(sig.R, d.pub, m) !== sig.c)!;
    expect(tampered).toBeDefined();
    expect(verify(sig, d.pub, tampered)).toBe(false);
  });
  it('the Lagrange coefficients for a size-t coalition sum the shares to the secret', () => {
    const S = [1, 2];
    const recombined = (lagrange0(S, 1) * 10 + lagrange0(S, 2) * 13) % N;
    expect(((recombined % N) + N) % N).toBe(7); // == the secret x
  });
});
