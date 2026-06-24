import { describe, it, expect } from 'vitest';
import { gIncrement, gMerge, gValue, lwwMerge, type GCounter } from '../src/web/crdt';

describe('G-Counter is a join semilattice', () => {
  const a: GCounter = { A: 3, B: 1 };
  const b: GCounter = { B: 4, C: 2 };
  const c: GCounter = { A: 1, C: 5 };

  it('merge is commutative', () => {
    expect(gMerge(a, b)).toEqual(gMerge(b, a));
  });
  it('merge is associative', () => {
    expect(gMerge(gMerge(a, b), c)).toEqual(gMerge(a, gMerge(b, c)));
  });
  it('merge is idempotent', () => {
    expect(gMerge(a, a)).toEqual(a);
    expect(gMerge(gMerge(a, b), b)).toEqual(gMerge(a, b));
  });
});

describe('concurrent increments are never lost', () => {
  it('two replicas increment offline, then merge to the sum', () => {
    let ra: GCounter = {}, rb: GCounter = {};
    ra = gIncrement(ra, 'A'); ra = gIncrement(ra, 'A'); // A: +2 offline
    rb = gIncrement(rb, 'B', 3); // B: +3 offline
    const merged = gMerge(ra, rb);
    expect(gValue(merged)).toBe(5); // both increments survive — no lost update
  });
  it('a redelivered/duplicated merge changes nothing (idempotent)', () => {
    const ra = gIncrement({}, 'A', 2), rb = gIncrement({}, 'B', 3);
    const once = gMerge(ra, rb);
    expect(gMerge(once, rb)).toEqual(once); // re-merging B's state is a no-op
  });
});

describe('LWW-Register converges deterministically', () => {
  it('the later timestamp wins, regardless of merge order', () => {
    const x = { value: 'red', ts: 5, replica: 'A' };
    const y = { value: 'blue', ts: 9, replica: 'B' };
    expect(lwwMerge(x, y).value).toBe('blue');
    expect(lwwMerge(y, x).value).toBe('blue'); // order-independent
  });
  it('ties break deterministically so all replicas agree', () => {
    const x = { value: 'red', ts: 7, replica: 'A' };
    const y = { value: 'blue', ts: 7, replica: 'B' };
    expect(lwwMerge(x, y)).toEqual(lwwMerge(y, x)); // same winner either way
  });
  it('merge is commutative even when ts AND replica collide (the divergence case)', () => {
    // same ts, same replica, different value — the final value tie-break must be order-free
    const x = { value: 'red', ts: 7, replica: 'A' };
    const y = { value: 'blue', ts: 7, replica: 'A' };
    expect(lwwMerge(x, y)).toEqual(lwwMerge(y, x)); // would diverge with a `>=` replica-only tiebreak
  });
});
