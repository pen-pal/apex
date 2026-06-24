import { describe, it, expect } from 'vitest';
import { commit, open, addCommit, generators } from '../src/web/pedersen';

const { N } = generators();

describe('Pedersen commitment open/verify', () => {
  it('a commitment opens with the correct (value, blinding) and rejects wrong ones', () => {
    const C = commit(4, 11);
    expect(open(C, 4, 11)).toBe(true);
    expect(open(C, 5, 11)).toBe(false); // wrong value
    expect(open(C, 4, 12)).toBe(false); // wrong blinding
  });
});

describe('hiding', () => {
  it('the same value with different blindings gives different commitments', () => {
    // so the commitment reveals nothing about the value on its own
    const a = commit(3, 2), b = commit(3, 8);
    expect(open(a, 3, 2)).toBe(true);
    expect(open(b, 3, 8)).toBe(true);
    expect(a).not.toEqual(b);
  });
});

describe('additive homomorphism — the key property', () => {
  it('C(v1,r1) + C(v2,r2) = C(v1+v2, r1+r2)', () => {
    for (const [v1, r1, v2, r2] of [[2, 5, 3, 7], [6, 1, 6, 10], [0, 3, 9, 9], [8, 8, 8, 8]]) {
      const sum = addCommit(commit(v1, r1), commit(v2, r2));
      expect(open(sum, (v1 + v2) % N, (r1 + r2) % N)).toBe(true);
    }
  });

  it('lets you prove inputs balance outputs without revealing amounts', () => {
    // confidential-transaction shape: commit(in) - commit(out) should commit to 0 if equal.
    // here: two inputs (5,4) vs one output (9), with matched blindings → difference opens to 0
    const inputs = addCommit(commit(5, 3), commit(4, 6)); // value 9, blinding 9
    const output = commit(9, 9);                          // value 9, blinding 9
    expect(inputs).toEqual(output); // identical commitment → the amounts provably match
    expect(open(inputs, 9, 9)).toBe(true);
  });
});
