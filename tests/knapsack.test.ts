import { describe, it, expect } from 'vitest';
import { knapsack, greedyByRatio, type Item } from '../src/web/knapsack';

// Classic example where greedy-by-ratio is suboptimal: capacity 5.
const ITEMS: Item[] = [
  { name: 'A', weight: 1, value: 6 },   // ratio 6
  { name: 'B', weight: 2, value: 10 },  // ratio 5
  { name: 'C', weight: 3, value: 12 },  // ratio 4
];

describe('0/1 knapsack DP', () => {
  const r = knapsack(ITEMS, 5);

  it('finds the optimal value 22 by taking B + C', () => {
    expect(r.best).toBe(22);
    expect(r.chosen).toEqual(['B', 'C']); // weights 2+3 = 5, values 10+12 = 22
  });
  it('the table has (n+1)×(W+1) cells with a zero first row', () => {
    expect(r.table).toHaveLength(4);
    expect(r.table[0]).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it('a few hand-computed table cells are right', () => {
    expect(r.table[3][5]).toBe(22); // all items, full capacity
    expect(r.table[2][3]).toBe(16); // A+B at capacity 3
    expect(r.table[1][5]).toBe(6);  // only A available
  });
});

describe('greedy-by-ratio is beaten on the 0/1 problem (the whole point)', () => {
  it('greedy grabs A then B and misses the optimum', () => {
    const g = greedyByRatio(ITEMS, 5);
    expect(g.value).toBe(16);      // A(1,6) + B(2,10), then C(3) won't fit in the remaining 2
    expect(g.value).toBeLessThan(knapsack(ITEMS, 5).best); // 16 < 22
  });
});

describe('edge cases', () => {
  it('zero capacity takes nothing', () => {
    const r = knapsack(ITEMS, 0);
    expect(r.best).toBe(0);
    expect(r.chosen).toEqual([]);
  });
  it('ample capacity takes everything', () => {
    const r = knapsack(ITEMS, 100);
    expect(r.best).toBe(28);       // 6+10+12
    expect(r.chosen).toEqual(['A', 'B', 'C']);
  });
  it('an item heavier than the whole knapsack is never chosen', () => {
    const r = knapsack([{ name: 'X', weight: 9, value: 99 }, { name: 'Y', weight: 2, value: 3 }], 5);
    expect(r.chosen).toEqual(['Y']);
    expect(r.best).toBe(3);
  });
});
