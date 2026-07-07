import { describe, it, expect } from 'vitest';
import { makeMsg, peel, permutation, mixBatch, anonymitySet, linkProbability, wireOf } from '../src/web/mixnet';

// A mix has no external numeric vector, so we test the defining INVARIANTS (Chaum 1981): a mix outputs exactly the
// messages it took in, in a permuted order (a bijection — nothing dropped, added, or duplicated); each message is
// peeled one layer; and the anonymity set an observer faces equals the batch size, so link probability is 1/N.

describe('permutation (Fisher–Yates over a seeded PRNG)', () => {
  it('is a genuine permutation of [0..n): every index appears exactly once', () => {
    for (const n of [1, 2, 5, 8, 20, 64]) {
      const p = permutation(n, 12345);
      expect(p.slice().sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });
  it('is deterministic for a given seed and varies with the seed', () => {
    expect(permutation(8, 7)).toEqual(permutation(8, 7));
    expect(permutation(8, 7)).not.toEqual(permutation(8, 8)); // overwhelmingly likely to differ
  });
});

describe('mixBatch preserves the message multiset (bijection) and peels a layer', () => {
  const inputs = Array.from({ length: 6 }, (_, i) => makeMsg(i, 3));

  it('outputs exactly the input ids, reordered — nothing lost, added, or duplicated', () => {
    const { outputs } = mixBatch(inputs, 99);
    expect(outputs.map((m) => m.id).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('perm[k] names the input that became output k (a valid permutation)', () => {
    const { outputs, perm } = mixBatch(inputs, 99);
    expect(perm.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    outputs.forEach((out, k) => expect(out.id).toBe(inputs[perm[k]].id));
  });
  it('every output has one fewer layer and different wire bytes than its input', () => {
    const { outputs, perm } = mixBatch(inputs, 99);
    outputs.forEach((out, k) => {
      const src = inputs[perm[k]];
      expect(out.layers).toBe(src.layers - 1);
      expect(out.wire).not.toBe(src.wire);
    });
  });
});

describe('peel', () => {
  it('drops one layer and changes the on-wire bytes, and never goes below zero', () => {
    const m = makeMsg(4, 2);
    const p1 = peel(m);
    expect(p1.layers).toBe(1);
    expect(p1.wire).not.toBe(m.wire);
    expect(peel(peel(p1)).layers).toBe(0); // clamps at 0, no negative layers
  });
  it('wire is deterministic per (id, layers)', () => {
    expect(wireOf(7, 3)).toBe(wireOf(7, 3));
    expect(wireOf(7, 3)).not.toBe(wireOf(7, 2));
  });
});

describe('anonymity set = batch size (the whole point)', () => {
  it('link probability is 1/N and strictly decreases as the batch grows', () => {
    expect(anonymitySet(8)).toBe(8);
    expect(linkProbability(8)).toBeCloseTo(0.125, 12);
    expect(linkProbability(2)).toBeCloseTo(0.5, 12);
    for (let n = 2; n <= 32; n++) expect(linkProbability(n)).toBeLessThan(linkProbability(n - 1));
  });
  it('a batch of one is no anonymity at all: link probability 1 (this is effectively immediate forwarding)', () => {
    expect(linkProbability(1)).toBe(1);
  });
});
