import { describe, it, expect } from 'vitest';
import { evaluate, type Service } from '../src/web/chaos';

// frontend → {orders → db, recs → ml}. recs has a fallback; the rest are hard dependencies.
const base = (over: Partial<Record<string, boolean>> = {}): Service[] => [
  { id: 'db', deps: [], resilient: false },
  { id: 'ml', deps: [], resilient: false },
  { id: 'orders', deps: ['db'], resilient: over.orders ?? false },
  { id: 'recs', deps: ['ml'], resilient: over.recs ?? true },
  { id: 'frontend', deps: ['orders', 'recs'], resilient: false },
];

describe('a resilient dependency contains the blast radius', () => {
  it('killing ml only degrades recs — the frontend stays up', () => {
    const r = evaluate(base(), 'ml');
    expect(r.down).toEqual(['ml']);          // blast radius is just ml
    expect(r.degraded).toEqual(['recs']);    // recs falls back
    expect(r.status['frontend']).toBe('up'); // user unaffected
  });
});

describe('a hard dependency cascades to the user', () => {
  it('killing db takes down orders AND the frontend', () => {
    const r = evaluate(base(), 'db');
    expect(r.down.sort()).toEqual(['db', 'frontend', 'orders']);
    expect(r.status['recs']).toBe('up'); // unrelated branch unaffected
  });

  it('making orders resilient shrinks the db-failure blast radius to just db', () => {
    const r = evaluate(base({ orders: true }), 'db');
    expect(r.down).toEqual(['db']);
    expect(r.degraded).toEqual(['orders']);
    expect(r.status['frontend']).toBe('up'); // now contained
  });
});

describe('baseline and edge behaviour', () => {
  it('with nothing failed, everything is up', () => {
    const r = evaluate(base(), null);
    expect(r.down).toEqual([]);
    expect(r.degraded).toEqual([]);
  });
  it('a degraded dependency still responds, so it does not take callers down', () => {
    // recs degrades on ml failure but frontend (depending on recs) stays up
    expect(evaluate(base(), 'ml').status['frontend']).toBe('up');
  });
  it('killing a leaf with many dependents has a large blast radius unless they are resilient', () => {
    const wide: Service[] = [
      { id: 'core', deps: [], resilient: false },
      { id: 'a', deps: ['core'], resilient: false },
      { id: 'b', deps: ['core'], resilient: false },
      { id: 'c', deps: ['core'], resilient: true },
    ];
    const r = evaluate(wide, 'core');
    expect(r.down.sort()).toEqual(['a', 'b', 'core']);
    expect(r.degraded).toEqual(['c']);
  });
});
