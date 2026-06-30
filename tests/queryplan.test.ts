import { describe, it, expect } from 'vitest';
import { planCost, optimize } from '../src/web/queryplan';

// A chain A—B—C where the B–C predicate is very selective and A–B is not.
// card: A=10000, B=10000, C=10. selectivity: A-B=0.5, B-C=0.001.
const card = { A: 10000, B: 10000, C: 10 };
const sel = { 'A~B': 0.5, 'B~C': 0.001 };

describe('plan cost = sum of intermediate cardinalities (System-R)', () => {
  it('the naive A,B,C order builds a 50-million-row intermediate', () => {
    const p = planCost(['A', 'B', 'C'], card, sel);
    expect(p.intermediates).toEqual([50_000_000, 500_000]); // A⋈B then ⋈C
    expect(p.cost).toBe(50_500_000);
  });
  it('joining the selective edge first keeps every intermediate tiny', () => {
    const p = planCost(['C', 'B', 'A'], card, sel);
    expect(p.intermediates).toEqual([100, 500_000]);        // C⋈B=100, then ⋈A
    expect(p.cost).toBe(500_100);                            // ~100× cheaper than A,B,C
  });
  it('a missing predicate is a cross product (selectivity 1)', () => {
    // A,C first have no edge → 10000×10 = 100000 cross product
    expect(planCost(['A', 'C', 'B'], card, sel).intermediates[0]).toBe(100_000);
  });
});

describe('the optimizer picks the cheapest order', () => {
  const plans = optimize(['A', 'B', 'C'], card, sel);
  it('returns all 6 orderings ranked cheapest-first', () => {
    expect(plans).toHaveLength(6);
    expect(plans[0].cost).toBeLessThanOrEqual(plans[5].cost);
  });
  it('the best plan starts by joining the selective B–C pair, beating the naive plan by ~100×', () => {
    const best = plans[0], naive = plans.find((p) => p.order.join() === 'A,B,C')!;
    expect(best.cost).toBe(500_100);
    expect(naive.cost / best.cost).toBeGreaterThan(90);
    // the cheapest order has B and C adjacent at the front (selective edge first)
    expect(best.order.slice(0, 2).sort()).toEqual(['B', 'C']);
  });
});
