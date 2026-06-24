import { describe, it, expect } from 'vitest';
import { majorityVote } from '../src/web/majority';

describe('finds a true majority', () => {
  it('3 is the majority of [3,3,4,2,3,3,3]', () => {
    const r = majorityVote([3, 3, 4, 2, 3, 3, 3]); // 3 appears 5/7 > 3
    expect(r.candidate).toBe(3);
    expect(r.isMajority).toBe(true);
    expect(r.actualCount).toBe(5);
    expect(r.threshold).toBe(3);
  });

  it('the classic [2,2,1,1,1,2,2] → 2 (appears 4/7)', () => {
    const r = majorityVote([2, 2, 1, 1, 1, 2, 2]);
    expect(r.candidate).toBe(2);
    expect(r.isMajority).toBe(true);
  });

  it('a bare majority (exactly more than half)', () => {
    const r = majorityVote([1, 2, 1, 2, 1]); // 1 appears 3/5 > 2
    expect(r.candidate).toBe(1);
    expect(r.isMajority).toBe(true);
  });
});

describe('no majority → verification catches it', () => {
  it('flags when the surviving candidate is not actually a majority', () => {
    const r = majorityVote([1, 2, 3, 4]); // no element > 2 times
    expect(r.isMajority).toBe(false);     // candidate survives the vote but fails verification
    expect(r.actualCount).toBeLessThanOrEqual(r.threshold);
  });

  it('a tie is not a majority', () => {
    expect(majorityVote([1, 1, 2, 2]).isMajority).toBe(false); // 2 each, neither > n/2
  });

  it('empty stream has no candidate', () => {
    expect(majorityVote([]).candidate).toBe(null);
  });
});

describe('the cancellation trace', () => {
  it('counts votes for and against, adopting a new candidate at zero', () => {
    const r = majorityVote([7, 7, 5, 5, 9]);
    expect(r.steps.map((s) => s.action)).toEqual(['adopt', 'vote+', 'vote-', 'vote-', 'adopt']);
    // counter hits 0 after the two 5s cancel the two 7s, then 9 is adopted
    expect(r.steps[3].count).toBe(0);
    expect(r.steps[4].candidate).toBe(9);
  });
});
