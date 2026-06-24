import { describe, it, expect } from 'vitest';
import { init2pc, prepare, decide, applyDecision, crashCoordinator, outcome } from '../src/web/twopc';

describe('2PC — happy path (unanimous yes → commit)', () => {
  it('prepares, decides commit, and everyone commits atomically', () => {
    let s = init2pc(['yes', 'yes', 'yes']);
    s = prepare(s);
    expect(s.participants.every((p) => p.state === 'prepared')).toBe(true);
    s = decide(s);
    expect(s.decision).toBe('commit');
    s = applyDecision(s);
    expect(s.participants.every((p) => p.state === 'committed')).toBe(true);
    expect(outcome(s)).toBe('committed');
  });
});

describe('2PC — any NO vote aborts the whole transaction', () => {
  it('a single NO forces a global abort (atomicity)', () => {
    let s = init2pc(['yes', 'no', 'yes']);
    s = prepare(s);
    expect(s.participants[1].state).toBe('aborted'); // the NO voter aborted in phase 1
    s = decide(s);
    expect(s.decision).toBe('abort');
    s = applyDecision(s);
    expect(s.participants.every((p) => p.state === 'aborted')).toBe(true); // nobody commits
    expect(outcome(s)).toBe('aborted');
  });
});

describe('2PC — the blocking problem', () => {
  it('a coordinator crash after prepare leaves YES voters IN-DOUBT (blocked)', () => {
    let s = init2pc(['yes', 'yes', 'yes']);
    s = prepare(s); // all prepared, holding locks
    // coordinator crashes before sending the decision
    s = crashCoordinator(s);
    expect(s.coordinatorAlive).toBe(false);
    expect(s.participants.every((p) => p.state === 'in-doubt')).toBe(true);
    expect(outcome(s)).toBe('blocked'); // stuck — can't commit or abort unilaterally
  });

  it('a crash AFTER the decision is delivered is safe (no in-doubt)', () => {
    let s = init2pc(['yes', 'yes']);
    s = prepare(s); s = decide(s); s = applyDecision(s); // committed
    s = crashCoordinator(s);
    expect(outcome(s)).toBe('committed'); // the decision was already durable everywhere
    expect(s.participants.some((p) => p.state === 'in-doubt')).toBe(false);
  });

  it('a NO voter is never in-doubt — it aborted on its own', () => {
    let s = init2pc(['yes', 'no']);
    s = prepare(s);
    s = crashCoordinator(s);
    expect(s.participants[1].state).toBe('aborted'); // the NO voter unilaterally aborted
    expect(s.participants[0].state).toBe('in-doubt'); // the YES voter is stuck
  });
});
