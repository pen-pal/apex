import { describe, it, expect } from 'vitest';
import { initMember, probe, suspicionExpire, refute, applySuspect } from '../src/web/swim';

describe('direct probing', () => {
  it('a direct ack keeps the node alive', () => {
    const o = probe(initMember('n2'), true, []);
    expect(o.member.status).toBe('alive');
    expect(o.via).toBe('direct');
  });
});

describe('indirect probing prevents false positives (the core SWIM idea)', () => {
  it('direct ping fails but a ping-req gets through → STILL alive, not suspect', () => {
    const o = probe(initMember('n2'), false, [false, true, false]); // 1 of 3 ping-reqs acked
    expect(o.member.status).toBe('alive');
    expect(o.via).toBe('indirect');
    expect(o.suspected).toBe(false);
  });
  it('only when direct AND all indirect probes fail does the node become SUSPECT (not dead)', () => {
    const o = probe(initMember('n2'), false, [false, false, false]);
    expect(o.member.status).toBe('suspect');
    expect(o.suspected).toBe(true);
  });
});

describe('suspicion → death, and refutation', () => {
  it('a suspect that never refutes is declared dead when the timer expires', () => {
    const suspect = probe(initMember('n2'), false, [false]).member;
    expect(suspect.status).toBe('suspect');
    expect(suspicionExpire(suspect).status).toBe('dead');
  });
  it('a refutation with a higher incarnation instantly clears the suspicion', () => {
    const suspect = probe(initMember('n2'), false, []).member; // incarnation 0, suspect
    const cleared = refute(suspect, 1);
    expect(cleared.status).toBe('alive');
    expect(cleared.incarnation).toBe(1);
  });
  it('a refutation that is not newer is ignored', () => {
    const suspect = { id: 'n2', status: 'suspect' as const, incarnation: 3 };
    expect(refute(suspect, 3).status).toBe('suspect'); // not strictly greater
    expect(refute(suspect, 2).status).toBe('suspect');
  });
});

describe('incarnation numbers reject stale gossip', () => {
  it('a stale suspicion (older incarnation than the last refute) is ignored', () => {
    const refuted = { id: 'n2', status: 'alive' as const, incarnation: 5 };
    expect(applySuspect(refuted, 4).status).toBe('alive'); // stale → ignored
    expect(applySuspect(refuted, 5).status).toBe('suspect'); // current → applies
  });
  it('death is terminal — no probe, stale suspicion, OR refutation can revive a dead node', () => {
    const dead = suspicionExpire(probe(initMember('n2'), false, []).member);
    expect(dead.status).toBe('dead');
    expect(probe(dead, true, []).member.status).toBe('dead');
    expect(applySuspect(dead, 99).status).toBe('dead');
    expect(refute(dead, 99).status).toBe('dead'); // Confirm(dead) overrides everything — no resurrection
  });
});
