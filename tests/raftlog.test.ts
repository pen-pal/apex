import { describe, it, expect } from 'vitest';
import { appendEntries, syncFollower, commitIndex, type Entry } from '../src/web/raftlog';

const E = (term: number, cmd: string): Entry => ({ term, cmd });

describe('AppendEntries log matching (§5.3)', () => {
  const follower = [E(1, 'a'), E(1, 'b')];
  it('rejects when the previous entry term does not match', () => {
    const r = appendEntries(follower, 1, 2, [E(3, 'x')]); // prevLogTerm 2 ≠ follower[1].term 1
    expect(r.ok).toBe(false);
    expect(r.log).toEqual(follower); // unchanged
  });
  it('accepts and appends when the consistency check passes', () => {
    const r = appendEntries(follower, 1, 1, [E(2, 'c')]);
    expect(r.ok).toBe(true);
    expect(r.log).toEqual([E(1, 'a'), E(1, 'b'), E(2, 'c')]);
  });
  it('overwrites a divergent suffix', () => {
    const diverged = [E(1, 'a'), E(1, 'b'), E(4, 'WRONG')];
    const r = appendEntries(diverged, 1, 1, [E(2, 'c'), E(2, 'd')]); // replace from index 2
    expect(r.ok).toBe(true);
    expect(r.log).toEqual([E(1, 'a'), E(1, 'b'), E(2, 'c'), E(2, 'd')]); // the term-4 entry is gone
  });
});

describe('leader backs up nextIndex until logs converge (§5.3)', () => {
  it('reconciles a follower that diverged several entries back', () => {
    const leader = [E(1, 'a'), E(2, 'b'), E(3, 'c'), E(3, 'd')];
    const follower = [E(1, 'a'), E(2, 'b'), E(4, 'zzz')]; // diverges at index 2
    const r = syncFollower(leader, follower);
    expect(r.log).toEqual(leader); // follower now matches the leader exactly
    expect(r.nextIndexTried[0]).toBe(4); // started optimistic at the tip
    expect(Math.min(...r.nextIndexTried)).toBeLessThanOrEqual(2); // backed up past the divergence
  });
});

describe('commit rule incl. the §5.4.2 Figure-8 safety', () => {
  it('advances commitIndex to a majority-replicated current-term entry', () => {
    const logs = [
      [E(1, 'a'), E(2, 'b'), E(3, 'c')], // leader, currentTerm 3
      [E(1, 'a'), E(2, 'b'), E(3, 'c')],
      [E(1, 'a'), E(2, 'b'), E(3, 'c')],
      [E(1, 'a')],
      [E(1, 'a')],
    ];
    expect(commitIndex(logs, 3)).toBe(2); // index 2 (term 3) on 3/5 → committed; everything ≤2 too
  });

  it('does NOT commit a prior-term entry by replica count alone, even at a majority', () => {
    const logs = [
      [E(1, 'a'), E(2, 'b'), E(3, 'c')], // leader, currentTerm 3
      [E(1, 'a'), E(2, 'b')], // term-2 entry replicated...
      [E(1, 'a'), E(2, 'b')], // ...on a majority (3/5 incl. leader)
      [E(1, 'a')],
      [E(1, 'a')],
    ];
    // index 1 (term 2) is on a majority, but term 2 ≠ current term 3 → MUST NOT be committed yet;
    // index 2 (term 3) is only on the leader → not a majority. So nothing commits.
    expect(commitIndex(logs, 3)).toBe(-1);
  });

  it('once a current-term entry commits, the prior-term entry below it is committed indirectly', () => {
    const logs = [
      [E(1, 'a'), E(2, 'b'), E(3, 'c')],
      [E(1, 'a'), E(2, 'b'), E(3, 'c')], // now the term-3 entry reaches a majority
      [E(1, 'a'), E(2, 'b'), E(3, 'c')],
      [E(1, 'a'), E(2, 'b')],
      [E(1, 'a')],
    ];
    expect(commitIndex(logs, 3)).toBe(2); // term-3 entry at index 2 commits → index 1 (term 2) now safe
  });
});
