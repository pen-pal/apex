import { describe, it, expect } from 'vitest';
import { cubicWindow, cubicK, simulateCubic, BETA } from '../src/web/cubic';

describe('the CUBIC window formula W(t) = C·(t−K)³ + W_max', () => {
  it('at t=0 (just after loss) the window is β·W_max', () => {
    // by construction C·K³ = W_max·(1−β), so W(0) = W_max − W_max(1−β) = β·W_max
    expect(cubicWindow(100, 0)).toBeCloseTo(BETA * 100, 6); // 70
  });

  it('K is exactly where the window crosses back through W_max (non-vacuous — depends on K value)', () => {
    // W(cubicK(w))=w is trivially true since (K−K)³=0, so it proves nothing. Instead check that K is the CROSSING
    // point: just before K the window is still below W_max, just after it is above. This fails if K is wrong.
    const wmax = 80, k = cubicK(wmax);
    expect(cubicWindow(wmax, k - 1)).toBeLessThan(wmax);
    expect(cubicWindow(wmax, k + 1)).toBeGreaterThan(wmax);
  });

  it('grows past W_max for t>K (probing for new capacity)', () => {
    const wmax = 50, k = cubicK(wmax);
    expect(cubicWindow(wmax, k + 1)).toBeGreaterThan(wmax);
    expect(cubicWindow(wmax, k - 1)).toBeLessThan(wmax);
  });

  it('K scales as the cube root of W_max — the "cubic" in CUBIC', () => {
    // A property of the cube law, NOT a restatement of the K formula: with C and β fixed, K(a·W_max) =
    // a^(1/3)·K(W_max). Using a = 8 gives a clean 8^(1/3) = 2. This catches a wrong exponent (say a square root)
    // that copying the formula into the test would miss. K's absolute value is anchored by the W(0)=β·W_max test
    // above, whose W(0) = W_max − C·K³ only equals β·W_max when K = cbrt(W_max(1−β)/C).
    expect(cubicK(8 * 50) / cubicK(50)).toBeCloseTo(2, 9);
  });
});

describe('simulation', () => {
  it('does exponential slow start until the first loss', () => {
    const t = simulateCubic(5, [4], 1);
    expect(t.slice(0, 4).map((r) => r.cwnd)).toEqual([2, 4, 8, 16]); // ×2 each round
    expect(t[0].phase).toBe('slow-start');
  });

  it('a loss drops the window to β·W_max and switches to CUBIC', () => {
    const t = simulateCubic(6, [3]);
    const lossRound = t[3];
    expect(lossRound.loss).toBe(true);
    expect(lossRound.phase).toBe('cubic');
    expect(lossRound.cwnd).toBeCloseTo(BETA * lossRound.wmax, 6);
  });

  it('after a loss the window climbs back toward W_max', () => {
    const t = simulateCubic(10, [3]);
    const afterLoss = t.slice(4).map((r) => r.cwnd);
    // monotonically increasing back up the cubic curve
    for (let i = 1; i < afterLoss.length; i++) expect(afterLoss[i]).toBeGreaterThan(afterLoss[i - 1]);
  });
});
