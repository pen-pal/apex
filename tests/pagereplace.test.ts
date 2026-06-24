import { describe, it, expect } from 'vitest';
import { simulate, BELADY_STRING, type Algo } from '../src/web/pagereplace';

// All fault counts below are the standard textbook values for the reference string
// 1,2,3,4,1,2,5,1,2,3,4,5 — independent external anchors, hand-traceable, not the code's own output.
const S = BELADY_STRING;
const faults = (a: Algo, n: number) => simulate(a, S, n).faults;

describe('page-replacement fault counts (textbook reference string)', () => {
  it('FIFO: 9 faults with 3 frames, 10 with 4 — BELADY’S ANOMALY (more frames, more faults)', () => {
    expect(faults('FIFO', 3)).toBe(9);
    expect(faults('FIFO', 4)).toBe(10);
    expect(faults('FIFO', 4)).toBeGreaterThan(faults('FIFO', 3)); // the anomaly, asserted directly
  });

  it('LRU: 10 faults with 3 frames, 8 with 4 — and LRU never exhibits the anomaly', () => {
    expect(faults('LRU', 3)).toBe(10);
    expect(faults('LRU', 4)).toBe(8);
    expect(faults('LRU', 4)).toBeLessThan(faults('LRU', 3)); // monotone, as a stack algorithm must be
  });

  it('OPT is the optimal lower bound: 7 faults with 3 frames', () => {
    expect(faults('OPT', 3)).toBe(7);
    // no realizable policy can beat OPT on the same input
    for (const a of ['FIFO', 'LRU', 'CLOCK'] as Algo[]) expect(faults(a, 3)).toBeGreaterThanOrEqual(faults('OPT', 3));
  });

  it('CLOCK approximates LRU: 9 faults with 3 frames (hand-traced second-chance)', () => {
    expect(faults('CLOCK', 3)).toBe(9);
  });
});

describe('simulation bookkeeping', () => {
  it('hits + faults always equals the reference length, for every policy and frame count', () => {
    for (const a of ['FIFO', 'LRU', 'OPT', 'CLOCK'] as Algo[]) {
      for (const n of [1, 2, 3, 4, 5]) {
        const r = simulate(a, S, n);
        expect(r.hits + r.faults).toBe(S.length);
        expect(r.steps).toHaveLength(S.length);
      }
    }
  });

  it('never holds more distinct pages than frames, and a hit never evicts', () => {
    const r = simulate('LRU', S, 3);
    for (const st of r.steps) {
      const live = st.frames.filter((x) => x !== null);
      expect(new Set(live).size).toBe(live.length); // no duplicates
      expect(live.length).toBeLessThanOrEqual(3);
      if (st.hit) expect(st.victim).toBeNull();
    }
  });

  it('with a single frame every distinct consecutive reference faults', () => {
    expect(simulate('FIFO', [1, 1, 2, 2, 3, 1], 1).faults).toBe(4); // 1,2,3,1 fault; the repeats hit
  });
});
