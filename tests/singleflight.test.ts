import { describe, it, expect } from 'vitest';
import { simulate, type Req } from '../src/web/singleflight';

const hot = (arrivals: number[]): Req[] => arrivals.map((arrival) => ({ key: 'hot', arrival }));

describe('singleflight collapses a thundering herd to one backend call', () => {
  // 7 requests for the same key; the computation takes 5 ticks.
  const reqs = hot([0, 1, 2, 3, 4, 5, 6]);

  it('naive: every concurrent miss recomputes', () => {
    const r = simulate(reqs, 5, false);
    expect(r.computations).toBe(5); // arrivals 0–4 are within the in-flight window
    expect(r.hits).toBe(2);         // arrivals 5,6 hit the now-warm cache
  });

  it('singleflight: the first computes, the concurrent ones share it', () => {
    const r = simulate(reqs, 5, true);
    expect(r.computations).toBe(1);
    expect(r.shared).toBe(4);       // arrivals 1–4 coalesce
    expect(r.hits).toBe(2);
  });

  it('coalescing strictly reduces backend load for the same workload', () => {
    expect(simulate(reqs, 5, true).computations).toBeLessThan(simulate(reqs, 5, false).computations);
  });
});

describe('boundaries and independence', () => {
  it('a request arriving exactly when the computation finishes is a cache hit, not shared', () => {
    const r = simulate(hot([0, 5]), 5, true); // arrival 5 == end of [0,5)
    expect(r.results[1].outcome).toBe('hit');
  });

  it('different keys never share — each distinct key computes once', () => {
    const reqs: Req[] = [{ key: 'a', arrival: 0 }, { key: 'a', arrival: 1 }, { key: 'b', arrival: 0 }, { key: 'b', arrival: 2 }];
    const r = simulate(reqs, 5, true);
    expect(r.computations).toBe(2); // one per distinct key
    expect(r.shared).toBe(2);       // the second a and b coalesce
  });

  it('with no overlap, every request just computes then hits (nothing to coalesce)', () => {
    const r = simulate(hot([0, 10, 20]), 5, true); // each arrives after the prior finished
    expect(r.computations).toBe(1); // first computes; cache stays warm for the rest
    expect(r.hits).toBe(2);
    expect(r.shared).toBe(0);
  });
});
