import { describe, it, expect } from 'vitest';
import { initRepl, append, replicateOne, replicateAll, commitIndex, quorum, leaderCrashes } from '../src/web/replication';

describe('quorum', () => {
  it('is a majority of the whole replica set (leader + followers)', () => {
    expect(quorum(2)).toBe(2); // 3 replicas → need 2
    expect(quorum(4)).toBe(3); // 5 replicas → need 3
  });
});

describe('append and follower lag', () => {
  it('appends in order; followers copy the log incrementally', () => {
    let s = initRepl('async', 2);
    s = append(s, 'a'); s = append(s, 'b'); s = append(s, 'c');
    expect(s.log).toEqual(['a', 'b', 'c']);
    expect(s.followers).toEqual([0, 0]); // not yet replicated
    s = replicateOne(s, 0); s = replicateOne(s, 0);
    expect(s.followers[0]).toBe(2); // follower 0 lags two-of-three behind
    expect(s.followers[1]).toBe(0);
  });
});

describe('commit index = replicated to a quorum', () => {
  it('advances only when a majority holds the entry', () => {
    let s = initRepl('sync', 2);
    s = append(s, 'x');
    expect(commitIndex(s)).toBe(0); // only the leader has it
    s = replicateOne(s, 0); // leader + follower0 = quorum of 2
    expect(commitIndex(s)).toBe(1);
  });
});

describe('SYNC — an ack waits for the quorum and is never lost', () => {
  it('does not acknowledge a write until a majority has replicated it', () => {
    let s = initRepl('sync', 2);
    s = append(s, 'a');
    expect(s.ackedIndex).toBe(0); // sync hasn't acked yet
    s = replicateOne(s, 0);
    expect(s.ackedIndex).toBe(1); // quorum reached → acked
  });
  it('a crash never loses an acknowledged write', () => {
    let s = initRepl('sync', 2);
    s = append(s, 'a'); s = replicateOne(s, 0); // 'a' acked (committed)
    s = append(s, 'b'); // 'b' appended but NOT yet acked
    const f = leaderCrashes(s);
    expect(f.survivedIndex).toBe(1); // follower0 had 1 entry
    expect(f.lost).toEqual(['b']); // only the un-acked tail is lost
    expect(f.ackedLost).toBe(false); // the SYNC guarantee: no acked data lost
  });
});

describe('ASYNC — fast but a crash loses the un-replicated tail', () => {
  it('acks immediately on the leader', () => {
    let s = initRepl('async', 2);
    s = append(s, 'a'); s = append(s, 'b');
    expect(s.ackedIndex).toBe(2); // acked before any follower copied it
  });
  it('loses acknowledged entries on failover', () => {
    let s = initRepl('async', 2);
    s = append(s, 'a'); s = append(s, 'b'); s = append(s, 'c'); // all acked (=3)
    s = replicateOne(s, 0); // only 'a' made it to a follower
    const f = leaderCrashes(s);
    expect(f.survivedIndex).toBe(1);
    expect(f.lost).toEqual(['b', 'c']);
    expect(f.ackedLost).toBe(true); // async can lose acked data — the trade-off
  });
});

describe('replicateAll catches everyone up', () => {
  it('commits the whole log to a quorum', () => {
    let s = initRepl('sync', 2);
    s = append(s, 'a'); s = append(s, 'b');
    s = replicateAll(s);
    expect(commitIndex(s)).toBe(2);
    expect(s.ackedIndex).toBe(2);
    expect(leaderCrashes(s).lost).toEqual([]); // nothing to lose
  });
});
