import { describe, it, expect } from 'vitest';
import { makeHashes, signature, estimateJaccard, trueJaccard } from '../src/web/minhash';

const shingle = (s: string): string[] => { const w: string[] = []; for (let i = 0; i <= s.length - 3; i++) w.push(s.slice(i, i + 3)); return w; };

describe('exact Jaccard (ground truth)', () => {
  it('is |A∩B| / |A∪B|', () => {
    expect(trueJaccard(['a', 'b', 'c'], ['b', 'c', 'd'])).toBeCloseTo(2 / 4, 9);
    expect(trueJaccard(['a', 'b'], ['a', 'b'])).toBe(1);
    expect(trueJaccard(['a'], ['z'])).toBe(0);
  });
});

describe('MinHash estimates', () => {
  const hashes = makeHashes(200, 7);
  it('identical sets give an identical signature → similarity exactly 1', () => {
    const a = signature(['a', 'b', 'c', 'd'], hashes);
    const b = signature(['d', 'c', 'b', 'a'], hashes);   // same set, different order
    expect(a).toEqual(b);
    expect(estimateJaccard(a, b)).toBe(1);
  });
  it('disjoint sets estimate ~0', () => {
    const a = signature(['a', 'b', 'c'], hashes);
    const d = signature(['x', 'y', 'z'], hashes);
    expect(estimateJaccard(a, d)).toBeLessThan(0.05);
  });
  it('tracks the true similarity of near-duplicate text', () => {
    const A = shingle('the quick brown fox jumps'), B = shingle('the quick brown cat jumps');
    const est = estimateJaccard(signature(A, hashes), signature(B, hashes));
    expect(Math.abs(est - trueJaccard(A, B))).toBeLessThan(0.1);
  });
  it('the signature is fixed-size regardless of set size', () => {
    expect(signature(['a'], hashes)).toHaveLength(200);
    expect(signature(Array.from({ length: 500 }, (_, i) => 'e' + i), hashes)).toHaveLength(200);
  });
});

describe('accuracy improves with more hash functions, and the estimator is unbiased', () => {
  it('average error shrinks roughly as 1/√k', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const randset = () => Array.from({ length: 5 + rnd(40) }, () => 'e' + rnd(60));
    const errFor = (k: number) => {
      const hs = makeHashes(k, 42); let err = 0; const T = 300;
      for (let t = 0; t < T; t++) { const X = randset(), Y = randset(); err += Math.abs(estimateJaccard(signature(X, hs), signature(Y, hs)) - trueJaccard(X, Y)); }
      return err / T;
    };
    const e16 = errFor(16), e256 = errFor(256);
    expect(e256).toBeLessThan(e16);           // more hashes → tighter
    expect(e256).toBeLessThan(1 / Math.sqrt(256) + 0.02); // within the ~1/√k bound
  });
  it('is unbiased: mean estimate ≈ mean true over many pairs', () => {
    let s = 5; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const randset = () => Array.from({ length: 5 + rnd(40) }, () => 'e' + rnd(60));
    const hs = makeHashes(128, 99); let se = 0, st = 0; const T = 1500;
    for (let t = 0; t < T; t++) { const X = randset(), Y = randset(); se += estimateJaccard(signature(X, hs), signature(Y, hs)); st += trueJaccard(X, Y); }
    expect(Math.abs(se / T - st / T)).toBeLessThan(0.02);
  });
});
