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
    // small worst-case sample: Eve uses the OPPOSITE basis everywhere, so she's wrong
    // wherever Alice=Bob basis, forcing Bob's sifted measurement to a coin flip.
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

// BB84's central, falsifiable, quantitative claim: a measure-resend eavesdropper who
// picks a RANDOM basis introduces ~25% error on the sifted bits — P(wrong basis)=1/2 ×
// P(coin then flips Bob's bit)=1/2. We anchor to that 0.25, not just "> 0".
describe('the measure-resend attack rate (Bennett–Brassard 1984)', () => {
  // deterministic PRNG so the statistical test is reproducible (no Math.random)
  const mulberry32 = (seed: number) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const N = 4000;
  const rng = mulberry32(12345);
  const aBits: Bit[] = Array.from({ length: N }, () => (rng() < 0.5 ? 0 : 1));
  const aBases: Basis[] = Array.from({ length: N }, () => (rng() < 0.5 ? '+' : 'x'));
  const bBases: Basis[] = Array.from({ length: N }, () => (rng() < 0.5 ? '+' : 'x'));
  const coins = Array.from({ length: N }, () => rng());

  it('a random-basis Eve drives the sifted error rate to ~25%', () => {
    const eBases: Basis[] = Array.from({ length: N }, () => (rng() < 0.5 ? '+' : 'x'));
    const eCoins = Array.from({ length: N }, () => rng());
    const r = run(aBits, aBases, bBases, coins, { eBases, eCoins });
    expect(Math.abs(r.errorRate - 0.25)).toBeLessThan(0.03);
  });

  it('an always-opposite-basis Eve is the worst case at ~50%', () => {
    const eBases: Basis[] = aBases.map((b) => (b === '+' ? 'x' : '+'));
    const eCoins = Array.from({ length: N }, () => rng());
    const r = run(aBits, aBases, bBases, coins, { eBases, eCoins });
    expect(Math.abs(r.errorRate - 0.5)).toBeLessThan(0.03);
  });

  it('and with no Eve at all the sifted error rate is exactly 0', () => {
    expect(run(aBits, aBases, bBases, coins).errorRate).toBe(0);
  });
});
