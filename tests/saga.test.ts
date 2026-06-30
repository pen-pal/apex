import { describe, it, expect } from 'vitest';
import { runSaga, type SagaStep } from '../src/web/saga';

// an order-placement saga
const ORDER: SagaStep[] = [
  { action: 'reserve inventory', compensation: 'release inventory' },
  { action: 'charge payment', compensation: 'refund payment' },
  { action: 'create shipment', compensation: 'cancel shipment' },
  { action: 'send confirmation', compensation: 'send cancellation' },
];

describe('the happy path commits', () => {
  it('every step runs and the saga commits', () => {
    const r = runSaga(ORDER, null);
    expect(r.outcome).toBe('committed');
    expect(r.completed).toEqual(['reserve inventory', 'charge payment', 'create shipment', 'send confirmation']);
    expect(r.log.every((e) => e.type === 'action' && e.ok)).toBe(true);
  });
});

describe('a failure compensates the completed steps in reverse', () => {
  it('failing at "create shipment" refunds the payment then releases the inventory', () => {
    const r = runSaga(ORDER, 2); // step index 2 fails
    expect(r.outcome).toBe('rolled back');
    expect(r.log).toEqual([
      { type: 'action', name: 'reserve inventory', ok: true },
      { type: 'action', name: 'charge payment', ok: true },
      { type: 'action', name: 'create shipment', ok: false },     // the failure
      { type: 'compensate', name: 'refund payment', ok: true },   // undo, reverse order
      { type: 'compensate', name: 'release inventory', ok: true },
    ]);
  });

  it('compensations run in the exact reverse of completion order', () => {
    const r = runSaga(ORDER, 3); // last real step fails after 3 completed
    const comps = r.log.filter((e) => e.type === 'compensate').map((e) => e.name);
    expect(comps).toEqual(['cancel shipment', 'refund payment', 'release inventory']);
  });

  it('failing at the first step compensates nothing', () => {
    const r = runSaga(ORDER, 0);
    expect(r.outcome).toBe('rolled back');
    expect(r.log.filter((e) => e.type === 'compensate')).toHaveLength(0);
    expect(r.completed).toEqual([]);
  });
});

describe('invariant', () => {
  it('a rolled-back saga compensates exactly the steps it had completed', () => {
    for (let f = 0; f < ORDER.length; f++) {
      const r = runSaga(ORDER, f);
      const comps = r.log.filter((e) => e.type === 'compensate');
      expect(comps).toHaveLength(f); // f steps completed before the failure → f compensations
    }
  });
});
