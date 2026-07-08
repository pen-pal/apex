import { describe, it, expect } from 'vitest';
import { topK, gateWeights, sparsity, load, imbalance } from '../src/web/moe';

// Independent oracle: MoE routing and accounting. top-k selects the k highest gate scores; the gate weights are a
// softmax over exactly those and sum to 1; active params = k/N of the total; per-expert load counts the routings; and
// a router is balanced when the busiest expert is close to the mean. Expected values are computed by hand.

describe('top-k routing', () => {
  it('picks the k highest-scoring experts, most preferred first', () => {
    expect(topK([0.1, 0.9, 0.3, 0.7], 2)).toEqual([1, 3]); // 0.9 then 0.7
    expect(topK([0.1, 0.9, 0.3, 0.7], 1)).toEqual([1]);
  });
});

describe('gate weights', () => {
  it('are a softmax over the selected experts and sum to 1', () => {
    const w = gateWeights([0.1, 0.9, 0.3, 0.7], [1, 3]);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(w[0]).toBeGreaterThan(w[1]); // expert 1 scored higher than 3, so gets more weight
  });
});

describe('sparsity', () => {
  it('active params are k/N of the total', () => {
    expect(sparsity(8, 2, 7)).toEqual({ activeB: 14, totalB: 56, pct: 25 });
    expect(sparsity(8, 1, 7).pct).toBe(13); // 12.5 rounds to 13
  });
});

describe('load and balance', () => {
  it('counts tokens routed to each expert', () => {
    expect(load([[0, 1], [0, 2], [0, 1]], 4)).toEqual([3, 2, 1, 0]);
  });
  it('a perfectly even router has imbalance 1; a skewed one is higher', () => {
    expect(imbalance([4, 4, 4, 4])).toBeCloseTo(1, 10);
    expect(imbalance([10, 1, 1, 0])).toBeGreaterThan(2); // one expert hogs the batch
  });
});
