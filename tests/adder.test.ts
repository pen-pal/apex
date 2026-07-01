import { describe, it, expect } from 'vitest';
import { fullAdder, rippleAdd } from '../src/web/adder';

describe('the full adder', () => {
  it('matches the truth table for all 8 input combinations', () => {
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
      const { sum, cout } = fullAdder(a, b, c);
      expect(sum).toBe((a + b + c) & 1);
      expect(cout).toBe((a + b + c) >> 1);   // carry when ≥2 inputs are 1
    }
  });
});

describe('ripple-carry addition', () => {
  it('adds like on paper, with overflow as the final carry-out', () => {
    expect(rippleAdd(13, 11, 8).sum).toBe(24);
    const o = rippleAdd(200, 100, 8);
    expect(o.sum).toBe(44);                   // 300 mod 256
    expect(o.carryOut).toBe(1);               // overflow
  });
  it('the worst case ripples the carry across every bit', () => {
    const w = rippleAdd(255, 1, 8);
    expect(w.sum).toBe(0);
    expect(w.carryOut).toBe(1);
    expect(w.rippleDepth).toBe(8);            // carry propagated through all 8 stages
  });
  it('records the correct carry-in/out at each bit', () => {
    const r = rippleAdd(0b0011, 0b0001, 4);   // 3 + 1 = 4: carry ripples bits 0→1→2
    expect(r.steps.map((s) => s.cout)).toEqual([1, 1, 0, 0]);
    expect(r.sum).toBe(4);
  });
  it('agrees with real addition over 50000 random pairs (1–16 bits)', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let i = 0; i < 50000; i++) {
      const bits = 1 + rnd(16), mask = (1 << bits) - 1;
      const a = rnd(1 << bits), b = rnd(1 << bits);
      const r = rippleAdd(a, b, bits);
      expect(r.sum).toBe((a + b) & mask);
      expect(r.carryOut).toBe(((a + b) >> bits) & 1);
    }
  });
});
