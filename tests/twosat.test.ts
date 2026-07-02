import { describe, it, expect } from 'vitest';
import { solve2sat, satisfies, type Clause } from '../src/web/twosat';

const C = (a: number, aTrue: boolean, b: number, bTrue: boolean): Clause => ({ a, aTrue, b, bTrue });

describe('small instances', () => {
  it('solves a satisfiable formula and returns a valid assignment', () => {
    const cl = [C(0, true, 1, true), C(0, false, 1, true)]; // (x0∨x1)∧(¬x0∨x1) → x1 true
    const s = solve2sat(2, cl);
    expect(s.sat).toBe(true);
    expect(satisfies(cl, s.assignment)).toBe(true);
    expect(s.assignment[1]).toBe(true);
  });
  it('detects the classic contradiction (x0) ∧ (¬x0) as unsatisfiable', () => {
    const s = solve2sat(1, [C(0, true, 0, true), C(0, false, 0, false)]);
    expect(s.sat).toBe(false);
    expect(s.conflictVar).toBe(0); // x0 and ¬x0 in the same SCC
  });
  it('detects a four-clause contradiction', () => {
    const cl = [C(0, true, 1, true), C(0, true, 1, false), C(0, false, 1, true), C(0, false, 1, false)];
    expect(solve2sat(2, cl).sat).toBe(false);
  });
});

describe('agrees with brute force over 20000 random instances', () => {
  it('verdict matches, and every claimed-SAT assignment truly satisfies every clause', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    const brute = (n: number, cl: Clause[]) => {
      for (let m = 0; m < (1 << n); m++) { const a = Array.from({ length: n }, (_, i) => !!(m & (1 << i))); if (satisfies(cl, a)) return true; }
      return false;
    };
    for (let t = 0; t < 20000; t++) {
      const n = 1 + rnd(6), nc = 1 + rnd(12); const cl: Clause[] = [];
      for (let i = 0; i < nc; i++) cl.push(C(rnd(n), rnd(2) === 0, rnd(n), rnd(2) === 0));
      const sol = solve2sat(n, cl);
      expect(sol.sat).toBe(brute(n, cl));              // verdict matches ground truth
      if (sol.sat) expect(satisfies(cl, sol.assignment)).toBe(true); // witness is valid
    }
  });
});
