// Idempotency keys — how an API makes a non-idempotent operation (POST /charge) safe to retry, turning
// at-least-once delivery into exactly-once EFFECT. Networks drop responses, so clients retry; without
// protection a retried "charge $100" charges twice. The fix: the client attaches a unique idempotency
// key, and the server records (key → result) the first time it runs the operation. A retry with the same
// key returns the STORED result without re-executing — no second charge. A second request with the same
// key while the first is still running is a CONFLICT (the client should back off and retry). Stripe,
// PayPal and most payment APIs require this. Reference: Stripe API idempotency; IETF idempotency-key draft.

export type Outcome = 'charged' | 'replayed' | 'conflict' | 'charged-unsafe';
export interface Result { chargeId: number; amount: number }
export interface HandleResult { outcome: Outcome; result: Result | null; charges: number; total: number }

export class PaymentService {
  private store = new Map<string, { state: 'inprogress' | 'completed'; result?: Result }>();
  charges = 0;   // number of times the side effect actually fired
  total = 0;     // total amount charged
  private nextId = 1;

  /** Process a charge. With an idempotency key, a retry is deduplicated; without one, every call charges. */
  handle(key: string | null, amount: number): HandleResult {
    if (key === null) { // no key → no dedup possible (the unsafe path)
      this.charges++; this.total += amount;
      return { outcome: 'charged-unsafe', result: { chargeId: this.nextId++, amount }, charges: this.charges, total: this.total };
    }
    const rec = this.store.get(key);
    if (rec?.state === 'completed') return { outcome: 'replayed', result: rec.result!, charges: this.charges, total: this.total };
    if (rec?.state === 'inprogress') return { outcome: 'conflict', result: null, charges: this.charges, total: this.total };

    this.store.set(key, { state: 'inprogress' });          // claim the key before doing the work
    this.charges++; this.total += amount;                  // the side effect — exactly once per key
    const result: Result = { chargeId: this.nextId++, amount };
    this.store.set(key, { state: 'completed', result });
    return { outcome: 'charged', result, charges: this.charges, total: this.total };
  }

  /** Simulate the first attempt timing out (response lost) and the client retrying with the same key. */
  beginInProgress(key: string) { this.store.set(key, { state: 'inprogress' }); }
}
