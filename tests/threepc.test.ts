import { describe, it, expect } from 'vitest';
import { twoPhase, threePhase } from '../src/web/threepc';

const YES = [true, true, true];
const ONE_NO = [true, false, true];

describe('happy path & abort — both protocols agree', () => {
  it('all yes, no failure → commit', () => {
    expect(twoPhase(YES, 'none').decision).toBe('commit');
    expect(threePhase(YES, 'none').decision).toBe('commit');
  });
  it('a single no → abort', () => {
    expect(twoPhase(ONE_NO, 'none').decision).toBe('abort');
    expect(threePhase(ONE_NO, 'none').decision).toBe('abort');
    expect(twoPhase(ONE_NO, 'afterVotes').decision).toBe('abort'); // a no aborts regardless of when the coord dies
  });
});

describe('the blocking flaw — the whole reason 3PC exists', () => {
  it('2PC BLOCKS when the coordinator crashes after votes, before the decision', () => {
    const r = twoPhase(YES, 'afterVotes');
    expect(r.decision).toBe('blocked');
    expect(r.blocking).toBe(true);
  });
  it('3PC never blocks on a coordinator crash — it decides among the survivors', () => {
    for (const fail of ['none', 'afterVotes', 'afterPrepare'] as const) {
      expect(threePhase(YES, fail).blocking).toBe(false);
    }
  });
});

describe('3PC termination protocol resolves the outcome from the survivors\' state', () => {
  it('crash BEFORE any pre-commit → safe to ABORT (nobody could have committed)', () => {
    expect(threePhase(YES, 'afterVotes').decision).toBe('abort');
  });
  it('crash AFTER a pre-commit → safe to COMMIT (a pre-commit implies everyone voted yes)', () => {
    expect(threePhase(YES, 'afterPrepare').decision).toBe('commit');
  });
  it('same coordinator crash: 2PC blocks, 3PC keeps going', () => {
    expect(twoPhase(YES, 'afterVotes').blocking).toBe(true);
    expect(threePhase(YES, 'afterVotes').blocking).toBe(false);
  });
});
