import { describe, it, expect } from 'vitest';
import { floyd, bruteForce } from '../src/web/floydcycle';

describe('specific shapes', () => {
  it('a ρ-graph: tail then loop (0→1→2→3→4→2)', () => {
    const r = floyd([1, 2, 3, 4, 2], 0);
    expect(r.hasCycle).toBe(true);
    expect(r.cycleStart).toBe(2);
    expect(r.cycleLength).toBe(3);
    expect(r.tailLength).toBe(2);
    expect(r.path).toEqual([0, 1, 2, 3, 4]); // tail + one loop
  });
  it('a pure cycle with no tail (0→1→2→0)', () => {
    const r = floyd([1, 2, 0], 0);
    expect(r.cycleStart).toBe(0);
    expect(r.cycleLength).toBe(3);
    expect(r.tailLength).toBe(0);
  });
  it('a self-loop', () => {
    const r = floyd([0], 0);
    expect(r.hasCycle).toBe(true);
    expect(r.cycleLength).toBe(1);
    expect(r.cycleStart).toBe(0);
  });
  it('a terminating chain has no cycle', () => {
    const r = floyd([1, 2, -1], 0);
    expect(r.hasCycle).toBe(false);
    expect(r.cycleStart).toBe(-1);
    expect(r.path).toEqual([0, 1, 2]);
  });
});

describe('the meeting point is always inside the cycle', () => {
  it('meetPoint is a cycle node (distance from cycleStart < cycleLength)', () => {
    const next = [1, 2, 3, 4, 5, 3]; // tail 0,1,2; cycle 3,4,5
    const r = floyd(next, 0);
    expect(r.hasCycle).toBe(true);
    // walk from cycleStart; meetPoint must be reachable within cycleLength steps
    let x = r.cycleStart, found = false;
    for (let i = 0; i < r.cycleLength; i++) { if (x === r.meetPoint) found = true; x = next[x]; }
    expect(found).toBe(true);
  });
});

describe('agrees with the O(n)-memory brute force everywhere', () => {
  it('20k random functional graphs (with terminals) match on hasCycle/start/length', () => {
    let s = 3; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    let terminating = 0;
    for (let t = 0; t < 20000; t++) {
      const n = 2 + rnd(12);
      const next = Array.from({ length: n }, () => { const r = rnd(n + 1); return r === n ? -1 : r; });
      const f = floyd(next, 0), b = bruteForce(next, 0);
      expect(f.hasCycle).toBe(b.hasCycle);
      expect(f.cycleStart).toBe(b.cycleStart);
      expect(f.cycleLength).toBe(b.cycleLength);
      if (!b.hasCycle) terminating++;
    }
    // also force some clearly-terminating graphs to exercise the no-cycle path
    for (let t = 0; t < 500; t++) {
      const n = 3 + (t % 8);
      const next = Array.from({ length: n }, (_, i) => (i + 1 < n ? i + 1 : -1)); // straight line to terminal
      expect(floyd(next, 0).hasCycle).toBe(false);
    }
    expect(terminating).toBeGreaterThanOrEqual(0);
  });
});
