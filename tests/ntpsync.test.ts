import { describe, it, expect } from 'vitest';
import { compute, simulate, asymmetryError } from '../src/web/ntp';

describe('NTP offset/delay formulas', () => {
  it('computes the textbook values', () => {
    // T1=0, T2=10, T3=12, T4=20 → delay=(20-0)-(12-10)=18, offset=((10-0)+(12-20))/2=1
    const r = compute({ t1: 0, t2: 10, t3: 12, t4: 20 });
    expect(r.delay).toBe(18);
    expect(r.offset).toBe(1);
  });
});

describe('recovering the clock offset from a simulated exchange', () => {
  it('is EXACT when the path is symmetric', () => {
    const s = simulate(50, 8, 8, 3); // server 50 ahead, symmetric 8/8 delay, 3 proc
    const r = compute(s);
    expect(r.offset).toBe(50); // perfectly recovered
    expect(r.delay).toBe(16); // dUp + dDown, proc cancels
  });

  it('the only error is half the path asymmetry', () => {
    const trueOffset = 50, dUp = 12, dDown = 4;
    const r = compute(simulate(trueOffset, dUp, dDown, 5));
    expect(r.offset).toBe(trueOffset + asymmetryError(dUp, dDown)); // 50 + 4 = 54
    expect(r.offset - trueOffset).toBe((dUp - dDown) / 2);
  });

  it("the server's processing time cancels out of both results", () => {
    const a = compute(simulate(30, 6, 10, 0));
    const b = compute(simulate(30, 6, 10, 999)); // huge processing delay
    expect(b.offset).toBe(a.offset);
    expect(b.delay).toBe(a.delay);
  });

  it('delay is the full round trip regardless of offset', () => {
    expect(compute(simulate(0, 7, 9, 2)).delay).toBe(16);
    expect(compute(simulate(1000, 7, 9, 2)).delay).toBe(16);
  });
});
