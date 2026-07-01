import { describe, it, expect } from 'vitest';
import { run, PATTERNS } from '../src/web/redos';

const almost = (n: number) => 'a'.repeat(n) + '!'; // n a's then a char that can't match → forces backtracking

describe('catastrophic backtracking on an evil pattern', () => {
  it('(a+)+ on an almost-matching input blows up exponentially', () => {
    const s = (n: number) => run(PATTERNS.evilPlus.node, almost(n)).steps;
    // deterministic step counts; each +4 chars multiplies the work ~16×
    expect(s(4)).toBe(48);
    expect(s(8)).toBe(768);
    expect(s(12)).toBe(12288);
    expect(s(8) / s(4)).toBe(16);
    expect(s(12) / s(8)).toBe(16); // constant ratio > 1 ⇒ exponential
  });
  it('never matches (there is no valid split), it just does exponential work', () => {
    expect(run(PATTERNS.evilPlus.node, almost(8)).matched).toBe(false);
  });
  it('bails out at the step limit instead of hanging', () => {
    const r = run(PATTERNS.evilPlus.node, almost(28), 100000);
    expect(r.blownUp).toBe(true);
    expect(r.steps).toBeGreaterThan(100000);
  });
});

describe('a safe pattern stays linear on the same input', () => {
  it('a+ is O(n), not O(2^n)', () => {
    const s = (n: number) => run(PATTERNS.safePlus.node, almost(n)).steps;
    expect(s(100)).toBe(102);
    expect(s(1000)).toBe(1002); // steps ≈ n + 2, linear
  });
});

describe('the evil pattern is only slow when the input ALMOST matches', () => {
  it('(a+)+ on a fully-matching input is fast — greedy grabs it all, no backtracking', () => {
    const r = run(PATTERNS.evilPlus.node, 'a'.repeat(100));
    expect(r.matched).toBe(true);
    expect(r.steps).toBeLessThan(200); // linear, not exponential
  });
  it('so ReDoS needs a near-miss, engineered by the attacker', () => {
    const fast = run(PATTERNS.evilPlus.node, 'a'.repeat(20)).steps;
    const slow = run(PATTERNS.evilPlus.node, almost(20), 5_000_000).steps;
    expect(slow).toBeGreaterThan(fast * 1000);
  });
});
