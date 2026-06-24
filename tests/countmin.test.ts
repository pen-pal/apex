import { describe, it, expect } from 'vitest';
import { create, add, estimate, cells, fromStream } from '../src/web/countmin';

describe('Count-Min Sketch counting', () => {
  it('returns the exact count when there are no collisions in some row', () => {
    const s = create(4, 64); // wide + tall → collisions unlikely for a few items
    for (let i = 0; i < 5; i++) add(s, 'apple');
    add(s, 'banana');
    expect(estimate(s, 'apple')).toBe(5);
    expect(estimate(s, 'banana')).toBe(1);
  });

  it('an item maps to exactly one cell per row', () => {
    const s = create(3, 16);
    expect(cells(s, 'x')).toHaveLength(3);
    expect(cells(s, 'x').every((c) => c >= 0 && c < 16)).toBe(true);
  });
});

describe('the one-sided error guarantee (never underestimates)', () => {
  it('every estimate is ≥ the true count, for a whole stream', () => {
    const stream: string[] = [];
    const words = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'apple', 'banana', 'cherry'];
    // deterministic skewed stream (no RNG)
    for (let i = 0; i < 400; i++) stream.push(words[(i * 7 + (i % 5)) % words.length]);
    const { sketch, truth } = fromStream(3, 8, stream); // narrow table forces collisions

    for (const [item, trueCount] of truth) {
      expect(estimate(sketch, item)).toBeGreaterThanOrEqual(trueCount); // CMS core guarantee
    }
  });

  it('a narrow sketch overestimates at least one item (collisions add up)', () => {
    const stream = Array.from({ length: 200 }, (_, i) => `item${i % 40}`);
    const { sketch, truth } = fromStream(2, 4, stream); // tiny: lots of collisions
    let anyOver = false;
    for (const [item, trueCount] of truth) if (estimate(sketch, item) > trueCount) anyOver = true;
    expect(anyOver).toBe(true);
  });

  it('a wider sketch is at least as accurate as a narrow one', () => {
    const stream = Array.from({ length: 300 }, (_, i) => `k${(i * 3) % 50}`);
    const narrow = fromStream(3, 8, stream);
    const wide = fromStream(3, 256, stream);
    const err = (r: ReturnType<typeof fromStream>) =>
      [...r.truth].reduce((sum, [item, t]) => sum + (estimate(r.sketch, item) - t), 0);
    expect(err(wide)).toBeLessThanOrEqual(err(narrow));
  });
});
