import { describe, it, expect } from 'vitest';
import { simulate, loopPattern } from '../src/web/branchpredict';

describe('2-bit saturating counter', () => {
  it('saturates at the strong-taken state and predicts taken there', () => {
    const r = simulate([true, true, true, true], '2bit', 2);
    expect(r.steps.map((s) => s.stateAfter)).toEqual([3, 3, 3, 3]); // clamped at 3
    expect(r.mispredictions).toBe(0);
  });
  it('one surprising outcome does NOT flip the prediction (hysteresis)', () => {
    // strong-taken (3), then a single not-taken → drops to weak-taken (2), still predicts taken
    const r = simulate([false], '2bit', 3);
    expect(r.steps[0].stateAfter).toBe(2);
    expect(simulate([false, true], '2bit', 3).steps[1].predicted).toBe(true); // still predicts taken next
  });
});

describe('the loop-exit pattern: 2-bit beats 1-bit', () => {
  // body taken 3×, then the exit (not-taken), repeated 3× → [T,T,T,F, T,T,T,F, T,T,T,F]
  const seq = loopPattern(3, 3);

  it('2-bit mispredicts once per loop (only the exit)', () => {
    const r = simulate(seq, '2bit', 2);
    expect(r.mispredictions).toBe(3); // one per iteration's fall-through
  });
  it('1-bit mispredicts about twice per loop (the exit AND the re-entry)', () => {
    const r = simulate(seq, '1bit', 1);
    expect(r.mispredictions).toBe(5); // exits at 4,8,12 + re-entry flips at 5,9 (last has no re-entry)
  });
  it('2-bit is strictly more accurate on this pattern', () => {
    expect(simulate(seq, '2bit', 2).mispredictions).toBeLessThan(simulate(seq, '1bit', 1).mispredictions);
  });
});

describe('predictor behaviour', () => {
  it('accuracy is reported as a fraction', () => {
    const r = simulate([true, true, true, false], '2bit', 3);
    expect(r.accuracy).toBeCloseTo(0.75, 6); // 3 of 4 correct
  });
  it('a perfectly alternating pattern is the worst case for a 1-bit predictor', () => {
    const alt = [true, false, true, false, true, false];
    const r = simulate(alt, '1bit', 1);
    expect(r.mispredictions).toBe(5); // wrong on all but the first
  });
});
