import { describe, it, expect } from 'vitest';
import { initCluster, majority, handleRequestVote, runElection, runRace, onHigherTerm, type Node } from '../src/web/raft';

describe('majority', () => {
  it('needs more than half', () => {
    expect(majority(5)).toBe(3);
    expect(majority(3)).toBe(2);
    expect(majority(4)).toBe(3);
  });
});

describe('RequestVote rules', () => {
  it('grants a vote at most once per term, to the first asker', () => {
    let node: Node = { id: 1, role: 'follower', term: 0, votedFor: null };
    const a = handleRequestVote(node, { candidate: 0, term: 1 });
    expect(a.granted).toBe(true);
    node = a.node;
    expect(node.votedFor).toBe(0);
    // a second candidate in the SAME term is refused
    const b = handleRequestVote(node, { candidate: 2, term: 1 });
    expect(b.granted).toBe(false);
  });
  it('rejects a candidate with a stale (lower) term', () => {
    const node = { id: 1, role: 'follower' as const, term: 5, votedFor: null };
    expect(handleRequestVote(node, { candidate: 0, term: 3 }).granted).toBe(false);
  });
  it('a higher term resets the vote and lets the new candidate win it', () => {
    const node = { id: 1, role: 'leader' as const, term: 2, votedFor: 9 };
    const r = handleRequestVote(node, { candidate: 0, term: 3 });
    expect(r.granted).toBe(true);
    expect(r.node.role).toBe('follower');
    expect(r.node.term).toBe(3);
  });
});

describe('runElection — a lone candidate wins the majority', () => {
  it('elects the candidate and demotes the rest to followers at the new term', () => {
    const r = runElection(initCluster(5), 2);
    expect(r.outcome).toBe('leader');
    expect(r.term).toBe(1);
    expect(r.votes.length).toBe(5); // everyone votes for the only candidate
    expect(r.nodes[2].role).toBe('leader');
    expect(r.nodes.filter((x) => x.role === 'follower')).toHaveLength(4);
    expect(r.nodes.every((x) => x.term === 1)).toBe(true);
  });
  it('fails to a split when a partition keeps it below majority', () => {
    // only node 2 (candidate) and node 0 are reachable → 2 votes < majority(5)=3
    const r = runElection(initCluster(5), 2, (id) => id === 0 || id === 2);
    expect(r.votes.length).toBe(2);
    expect(r.outcome).toBe('split');
    expect(r.nodes[2].role).toBe('candidate'); // never became leader
  });
});

describe('runRace — a split vote elects no one', () => {
  it('two candidates divide the votes, nobody reaches majority', () => {
    const r = runRace(initCluster(4), [0, 1]); // 4 nodes → majority 3
    expect(r.outcome).toBe('split');
    expect(r.leader).toBeNull();
    expect(r.tallies[0].length).toBe(2);
    expect(r.tallies[1].length).toBe(2); // 2 + 2, neither has 3
    expect(r.term).toBe(1); // the failed term; a retry would be term 2
  });
  it('a clear majority in a race does elect a leader', () => {
    const r = runRace(initCluster(5), [0, 1]); // 5 nodes, majority 3
    expect(r.outcome).toBe('leader');
    expect(r.leader).not.toBeNull();
    expect(r.tallies[r.leader!].length).toBeGreaterThanOrEqual(3);
  });
});

describe('higher term demotes a leader', () => {
  it('a leader that hears a newer term reverts to follower', () => {
    const leader = { id: 0, role: 'leader' as const, term: 3, votedFor: 0 };
    const demoted = onHigherTerm(leader, 4);
    expect(demoted.role).toBe('follower');
    expect(demoted.term).toBe(4);
    expect(demoted.votedFor).toBeNull();
  });
});
