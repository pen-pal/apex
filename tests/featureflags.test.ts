import { describe, it, expect } from 'vitest';
import { evaluate, bucketOf, type Flag, type User } from '../src/web/featureflags';

const flag = (over: Partial<Flag> = {}): Flag => ({ key: 'new-checkout', enabled: true, rules: [], rolloutPercent: 0, ...over });

describe('evaluation precedence', () => {
  it('a disabled flag is off for everyone (kill switch beats everything)', () => {
    const f = flag({ enabled: false, rolloutPercent: 100, rules: [{ attribute: 'plan', value: 'beta', result: true }] });
    const e = evaluate(f, { id: 'u1', plan: 'beta' });
    expect(e.on).toBe(false);
    expect(e.reason).toMatch(/kill switch/);
  });

  it('a targeting rule wins over the percentage rollout', () => {
    const f = flag({ rolloutPercent: 0, rules: [{ attribute: 'country', value: 'US', result: true }] });
    expect(evaluate(f, { id: 'u1', country: 'US' }).on).toBe(true);   // rule → on even at 0% rollout
    expect(evaluate(f, { id: 'u1', country: 'CA' }).on).toBe(false);  // no rule, 0% rollout → off
  });

  it('0% rollout is off for all; 100% is on for all (no rule)', () => {
    const users: User[] = Array.from({ length: 20 }, (_, i) => ({ id: `user-${i}` }));
    expect(users.every((u) => evaluate(flag({ rolloutPercent: 0 }), u).on === false)).toBe(true);
    expect(users.every((u) => evaluate(flag({ rolloutPercent: 100 }), u).on === true)).toBe(true);
  });
});

describe('percentage rollout is stable and monotonic', () => {
  it('the same user always lands in the same bucket', () => {
    expect(bucketOf('new-checkout', 'alice')).toBe(bucketOf('new-checkout', 'alice'));
    expect(bucketOf('new-checkout', 'alice')).toBeGreaterThanOrEqual(0);
    expect(bucketOf('new-checkout', 'alice')).toBeLessThan(100);
  });

  it('increasing the rollout only ADDS users — never flips one back off', () => {
    const u: User = { id: 'alice' };
    const b = bucketOf('new-checkout', 'alice');
    // on exactly when bucket < percent, so on@p implies on@(p+k)
    expect(evaluate(flag({ rolloutPercent: b }), u).on).toBe(false);     // bucket < b is false
    expect(evaluate(flag({ rolloutPercent: b + 1 }), u).on).toBe(true);  // now bucket < b+1
    expect(evaluate(flag({ rolloutPercent: 100 }), u).on).toBe(true);
  });

  it('a ~50% rollout splits a population roughly in half (deterministically)', () => {
    const users: User[] = Array.from({ length: 500 }, (_, i) => ({ id: `u${i}` }));
    const on = users.filter((u) => evaluate(flag({ rolloutPercent: 50 }), u).on).length;
    expect(on).toBeGreaterThan(200);
    expect(on).toBeLessThan(300); // close to 250, never exactly 250 with a real hash
  });

  it('different flags bucket the same user independently', () => {
    // a user near a boundary for one flag is generally elsewhere for another
    expect(bucketOf('flag-a', 'alice')).not.toBe(bucketOf('flag-zzz', 'alice'));
  });
});
