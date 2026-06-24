import { describe, it, expect } from 'vitest';
import { cubicWindow, cubicK, simulateCubic, BETA, C } from '../src/web/cubic';

describe('the CUBIC window formula W(t) = C·(t−K)³ + W_max', () => {
  it('at t=0 (just after loss) the window is β·W_max', () => {
    // by construction C·K³ = W_max·(1−β), so W(0) = W_max − W_max(1−β) = β·W_max
    expect(cubicWindow(100, 0)).toBeCloseTo(BETA * 100, 6); // 70
  });

  it('at t=K the window is exactly W_max again (the plateau)', () => {
    const wmax = 80;
    expect(cubicWindow(wmax, cubicK(wmax))).toBeCloseTo(wmax, 6);
  });

  it('grows past W_max for t>K (probing for new capacity)', () => {
    const wmax = 50, k = cubicK(wmax);
    expect(cubicWindow(wmax, k + 1)).toBeGreaterThan(wmax);
    expect(cubicWindow(wmax, k - 1)).toBeLessThan(wmax);
  });

  it('K scales with the cube root of W_max', () => {
    expect(cubicK(100)).toBeCloseTo(Math.cbrt((100 * (1 - BETA)) / C), 9);
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
