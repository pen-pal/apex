import { describe, it, expect } from 'vitest';
import { now, commitWait, externalConsistency } from '../src/web/truetime';

describe('TrueTime intervals & commit-wait (Spanner)', () => {
  it('TT.now() is the bounded interval [t−ε, t+ε]', () => {
    expect(now(100, 5)).toEqual({ earliest: 95, latest: 105 });
  });
  it('commit timestamp is the latest possible now, and the wait is 2ε', () => {
    const c = commitWait(100, 5);
    expect(c.commitTs).toBe(105); // t + ε
    expect(c.waitMs).toBe(10); // 2ε — the cost of correctness
    expect(c.visibleAt).toBe(110); // t + 2ε, when the timestamp is safely in the past
  });
  it('commit latency scales with clock uncertainty', () => {
    expect(commitWait(0, 1).waitMs).toBe(2); // tighter clock (small ε) ⇒ faster commit
    expect(commitWait(0, 7).waitMs).toBe(14); // looser clock (large ε) ⇒ slower commit
  });
});

describe('external consistency depends on commit-wait', () => {
  it('WITH commit-wait, a later transaction always gets a strictly greater timestamp', () => {
    const r = externalConsistency(100, 100, 5, true);
    expect(r.t1VisibleAt).toBe(110); // T1 not visible until t1+2ε
    expect(r.ts1).toBe(105);
    expect(r.ts2).toBe(115); // T2 starts at 110, ts2 = 115
    expect(r.ordered).toBe(true);
  });
  it('WITHOUT commit-wait, a happens-after transaction can grab an equal/earlier timestamp (the anomaly)', () => {
    const r = externalConsistency(100, 100, 5, false);
    expect(r.t1VisibleAt).toBe(100); // released immediately, before ts1 is past
    expect(r.ts1).toBe(105);
    expect(r.ts2).toBe(105); // T2 begins at 100, picks 105 == ts1
    expect(r.ordered).toBe(false); // external consistency VIOLATED
  });
  it('commit-wait preserves ordering even for back-to-back transactions across any ε', () => {
    for (const eps of [1, 5, 20]) expect(externalConsistency(50, 50, eps, true).ordered).toBe(true);
  });
});
