// The Saga pattern — how microservices pull off a "transaction" across services that have separate
// databases, where a classic two-phase commit (holding locks across all of them) isn't an option. A saga
// is a sequence of local steps, each with a COMPENSATING action that semantically undoes it. Run the
// steps forward; if one fails, you can't roll back the ones already committed (they're durable in other
// services), so instead you run their compensations in REVERSE order — refund the charge, release the
// inventory — driving the system back to a consistent state. It trades atomic isolation for availability
// and eventual consistency: other observers can briefly see partial progress, and compensations must be
// idempotent and (ideally) always succeed. Orchestrated (a coordinator drives it) or choreographed
// (services react to each other's events). Reference: Garcia-Molina & Salem, "Sagas" (1987); microservices practice.

export interface SagaStep { action: string; compensation: string }
export type EntryType = 'action' | 'compensate';
export interface LogEntry { type: EntryType; name: string; ok: boolean }
export interface SagaResult { log: LogEntry[]; outcome: 'committed' | 'rolled back'; completed: string[] }

/** Run a saga; if `failAt` is a step index, that step's action fails and the prior steps are compensated
 *  in reverse order. `failAt = null` means every step succeeds. */
export function runSaga(steps: SagaStep[], failAt: number | null): SagaResult {
  const log: LogEntry[] = [];
  const completed: SagaStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (i === failAt) {
      log.push({ type: 'action', name: steps[i].action, ok: false }); // this step failed
      for (let j = completed.length - 1; j >= 0; j--) log.push({ type: 'compensate', name: completed[j].compensation, ok: true }); // undo in reverse
      return { log, outcome: 'rolled back', completed: completed.map((s) => s.action) };
    }
    log.push({ type: 'action', name: steps[i].action, ok: true });
    completed.push(steps[i]);
  }
  return { log, outcome: 'committed', completed: completed.map((s) => s.action) };
}
