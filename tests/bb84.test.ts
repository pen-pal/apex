import { describe, it, expect } from 'vitest';
import { measure, run, type Basis, type Bit } from '../src/web/bb84';

describe('measurement', () => {
  it('matching basis reads the bit; mismatched basis is a coin flip', () => {
    expect(measure(1, '+', '+', 0.9)).toBe(1); // match → exact
    expect(measure(1, '+', 'x', 0.2)).toBe(0); // mismatch → coin (<0.5)
    expect(measure(1, '+', 'x', 0.8)).toBe(1); // mismatch → coin (>=0.5)
  });
});

const A: Bit[] = [0, 1, 1, 0, 1, 0, 0, 1];
const AB: Basis[] = ['+', '+', 'x', 'x', '+', 'x', '+', 'x'];
const BB: Basis[] = ['+', 'x', 'x', '+', '+', 'x', '+', '+']; // matches at 0,2,4,5,6
const COINS = [0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9];

describe('BB84 without an eavesdropper', () => {
  const r = run(A, AB, BB, COINS);
  it('the sifted keys agree exactly (zero error)', () => {
    expect(r.bobKey).toEqual(r.aliceKey);
    expect(r.errors).toBe(0);
    expect(r.errorRate).toBe(0);
  });
  it('sifting keeps only the matching-basis positions', () => {
    expect(r.sifted).toBe(5); // positions 0,2,4,5,6
    expect(r.aliceKey).toEqual([0, 1, 1, 0, 0]);
  });
});

describe('an eavesdropper injects detectable errors', () => {
  it('Eve measuring in wrong bases corrupts some sifted bits', () => {
    // Eve uses the OPPOSITE basis everywhere → she's wrong wherever Alice=Bob basis,
    // forcing Bob's sifted measurement to a coin flip and producing errors.
    const eBases: Basis[] = AB.map((b) => (b === '+' ? 'x' : '+'));
    const eCoins = [0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1];
    const r = run(A, AB, BB, COINS, { eBases, eCoins });
    expect(r.errors).toBeGreaterThan(0); // disturbance is visible
    expect(r.errorRate).toBeGreaterThan(0);
  });
  it('with no eavesdropper the same run has zero errors (the baseline)', () => {
    expect(run(A, AB, BB, COINS).errorRate).toBe(0);
  });
});
