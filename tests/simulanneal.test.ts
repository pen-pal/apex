import { describe, it, expect } from 'vitest';
import { makeLandscape, acceptProb, greedyDescent, anneal, makeRng } from '../src/web/simulanneal';

const land = makeLandscape(60);
const OPTS = { T0: 12, alpha: 0.998, steps: 4000 };

describe('the Metropolis acceptance rule', () => {
  it('always accepts downhill; accepts uphill with prob exp(-dE/T), vanishing as T cools', () => {
    expect(acceptProb(-3, 10)).toBe(1);
    expect(acceptProb(0, 10)).toBe(1);
    expect(acceptProb(5, 10)).toBeCloseTo(Math.exp(-0.5), 6); // 0.6065
    expect(acceptProb(5, 0.1)).toBeLessThan(1e-20); // cold: uphill essentially never
  });
});

describe('greedy descent gets trapped; annealing escapes', () => {
  it('greedy from the local slope stalls in the local minimum (index 44)', () => {
    const g = greedyDescent(land, 50);
    expect(g.end).toBe(44);          // the shallow local well
    expect(land[44]).toBe(4);        // strictly worse than the global min (0)
    expect(g.end).toBeGreaterThan(28); // never crosses to the global side
  });

  it('annealing (seed 2) climbs over the barrier and reaches the GLOBAL minimum', () => {
    const a = anneal(land, 50, OPTS, makeRng(2));
    expect(a.best).toBe(12);         // the exact global minimum
    expect(land[a.best]).toBe(0);
    expect(a.path.some((s) => s.dE > 0 && s.accepted)).toBe(true); // it accepted uphill moves to get there
  });

  it('across 300 seeds, annealing reaches the global side often; greedy never does', () => {
    let saGlobal = 0;
    for (let seed = 1; seed <= 300; seed++) if (anneal(land, 50, OPTS, makeRng(seed)).best < 28) saGlobal++;
    expect(saGlobal).toBeGreaterThan(30);  // a real fraction escape the trap (~27%)
    // greedy is deterministic and always stuck, from any start on the local slope
    for (let start = 40; start <= 55; start++) expect(greedyDescent(land, start).end).toBeGreaterThan(28);
  });
});
