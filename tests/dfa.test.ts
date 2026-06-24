import { describe, it, expect } from 'vitest';
import { run, divisibleBy, containsAB } from '../src/web/dfa';

describe('divisible-by-3 DFA matches the arithmetic', () => {
  const d = divisibleBy(3);
  it('accepts exactly the binary strings whose value % 3 === 0', () => {
    for (let n = 0; n <= 50; n++) {
      const bin = n.toString(2);
      expect(run(d, bin).accepted).toBe(n % 3 === 0);
    }
  });
  it('hand-checked cases', () => {
    expect(run(d, '0').accepted).toBe(true);    // 0
    expect(run(d, '11').accepted).toBe(true);   // 3
    expect(run(d, '110').accepted).toBe(true);  // 6
    expect(run(d, '1').accepted).toBe(false);   // 1
    expect(run(d, '100').accepted).toBe(false); // 4
  });
  it('the state IS the remainder, and the path tracks it', () => {
    const r = run(d, '1101'); // 13 → 13 % 3 = 1
    expect(r.path[r.path.length - 1]).toBe('r1');
    expect(r.accepted).toBe(false);
  });
});

describe('divisible-by-5 DFA', () => {
  const d = divisibleBy(5);
  it('accepts multiples of 5', () => {
    for (const n of [0, 5, 10, 15, 20, 25]) expect(run(d, n.toString(2)).accepted).toBe(true);
    for (const n of [1, 7, 13, 19]) expect(run(d, n.toString(2)).accepted).toBe(false);
  });
});

describe('contains-"ab" DFA', () => {
  const d = containsAB();
  it('accepts iff the string contains "ab"', () => {
    for (const s of ['ab', 'aab', 'abb', 'bbabb', 'aaab']) expect(run(d, s).accepted).toBe(true);
    for (const s of ['', 'a', 'b', 'ba', 'aaa', 'bba']) expect(run(d, s).accepted).toBe(false);
  });
  it('records the state path', () => {
    expect(run(d, 'aab').path).toEqual(['start', 'sawA', 'sawA', 'done']);
  });
});
