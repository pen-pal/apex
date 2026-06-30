import { describe, it, expect } from 'vitest';
import { PaymentService } from '../src/web/idempotency';

describe('idempotency keys deduplicate retries', () => {
  it('the first request with a key charges; a retry with the same key replays without charging again', () => {
    const svc = new PaymentService();
    const first = svc.handle('key-abc', 100);
    expect(first.outcome).toBe('charged');
    expect(svc.charges).toBe(1);
    expect(svc.total).toBe(100);

    const retry = svc.handle('key-abc', 100);
    expect(retry.outcome).toBe('replayed');
    expect(retry.result).toEqual(first.result);  // same charge id returned
    expect(svc.charges).toBe(1);                  // NOT charged twice
    expect(svc.total).toBe(100);
  });

  it('many retries of the same key still charge exactly once', () => {
    const svc = new PaymentService();
    for (let i = 0; i < 5; i++) svc.handle('k1', 50);
    expect(svc.charges).toBe(1);
    expect(svc.total).toBe(50);
  });

  it('different keys are different operations and each charges', () => {
    const svc = new PaymentService();
    svc.handle('k1', 100);
    svc.handle('k2', 100);
    expect(svc.charges).toBe(2);
    expect(svc.total).toBe(200);
  });
});

describe('the unsafe path and concurrency', () => {
  it('without an idempotency key, a retry charges AGAIN (double charge)', () => {
    const svc = new PaymentService();
    svc.handle(null, 100);
    svc.handle(null, 100); // the same logical request retried, no key
    expect(svc.charges).toBe(2);
    expect(svc.total).toBe(200); // the bug idempotency keys prevent
  });

  it('a same-key request while the first is still in flight is a conflict', () => {
    const svc = new PaymentService();
    svc.beginInProgress('k1');               // first attempt is mid-execution
    const concurrent = svc.handle('k1', 100);
    expect(concurrent.outcome).toBe('conflict');
    expect(svc.charges).toBe(0);             // the concurrent retry did not charge
  });
});
