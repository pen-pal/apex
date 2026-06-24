import { describe, it, expect } from 'vitest';
import { runPaxos, type Proposal } from '../src/web/paxos';

describe('single-decree Paxos safety', () => {
  it('a value accepted by a majority is chosen', () => {
    const r = runPaxos(3, [{ proposer: 'A', n: 1, preferred: 'X' }]);
    expect(r.chosen).toBe('X');
    expect(r.steps.some((s) => s.phase === 'decision' && s.value === 'X')).toBe(true);
  });

  it('a later, higher ballot is FORCED to re-propose the chosen value', () => {
    // A chooses X at ballot 1; B then runs ballot 2 preferring Y — but must adopt X.
    const props: Proposal[] = [
      { proposer: 'A', n: 1, preferred: 'X' },
      { proposer: 'B', n: 2, preferred: 'Y' },
    ];
    const r = runPaxos(3, props);
    // B's Accept step must carry X, not its own preference Y
    const bAccept = r.steps.find((s) => s.proposer === 'B' && s.phase === 'accept')!;
    expect(bAccept.value).toBe('X');
    expect(bAccept.text).toMatch(/re-propose/);
    expect(r.chosen).toBe('X'); // consensus is stable — Y can never win
  });

  it('a lower ballot arriving after a higher promise is rejected (no majority)', () => {
    // B promises ballot 2 everywhere and chooses Y; A's ballot 1 can no longer get promises.
    const props: Proposal[] = [
      { proposer: 'B', n: 2, preferred: 'Y' },
      { proposer: 'A', n: 1, preferred: 'X' },
    ];
    const r = runPaxos(3, props);
    expect(r.chosen).toBe('Y');
    const aFail = r.steps.find((s) => s.proposer === 'A' && s.phase === 'fail');
    expect(aFail).toBeTruthy();
  });

  it('with no majority of promises a proposal cannot proceed to accept', () => {
    // 5 acceptors but we model two competing proposals; the second (lower) gets shut out
    const r = runPaxos(5, [
      { proposer: 'B', n: 9, preferred: 'Y' },
      { proposer: 'A', n: 4, preferred: 'X' },
    ]);
    expect(r.chosen).toBe('Y');
    expect(r.steps.filter((s) => s.proposer === 'A' && s.phase === 'accepted')).toHaveLength(0);
  });
});

describe('acceptor bookkeeping', () => {
  it('records the accepted ballot and value on every acceptor in the majority', () => {
    const r = runPaxos(3, [{ proposer: 'A', n: 7, preferred: 'V' }]);
    const last = r.steps[r.steps.length - 1];
    expect(last.acceptors.every((a) => a.acceptedN === 7 && a.acceptedV === 'V')).toBe(true);
    expect(last.acceptors.every((a) => a.promised === 7)).toBe(true);
  });
});
