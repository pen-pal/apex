// The Saga pattern, made visible. An order runs through a chain of local steps, each with a compensating
// undo. Pick which step fails and step through: the actions run forward (green), and the moment one
// fails, the compensations fire in REVERSE for everything already committed (orange) — refund the
// charge, release the inventory — landing back in a consistent state without any distributed lock. Real
// model from saga.ts.
import { useMemo, useState } from 'react';
import { runSaga, type SagaStep } from './saga';

const ORDER: SagaStep[] = [
  { action: 'reserve inventory', compensation: 'release inventory' },
  { action: 'charge payment', compensation: 'refund payment' },
  { action: 'create shipment', compensation: 'cancel shipment' },
  { action: 'send confirmation', compensation: 'send cancellation' },
];

export function SagaSection() {
  const [failAt, setFailAt] = useState<number | null>(2);
  const [step, setStep] = useState(0);
  const r = useMemo(() => runSaga(ORDER, failAt), [failAt]);
  const shown = r.log.slice(0, step);

  const setFail = (f: number | null) => { setFailAt(f); setStep(0); };

  // per-step status from the shown log
  const statusOf = (i: number): 'pending' | 'ok' | 'failed' | 'compensated' => {
    const act = shown.find((e) => e.type === 'action' && e.name === ORDER[i].action);
    const comp = shown.find((e) => e.type === 'compensate' && e.name === ORDER[i].compensation);
    if (comp) return 'compensated';
    if (act) return act.ok ? 'ok' : 'failed';
    return 'pending';
  };

  return (
    <div className="saga">
      <div className="saga-controls">
        <span className="saga-cl">inject failure at:</span>
        {ORDER.map((s, i) => <button key={i} type="button" className={`saga-fbtn ${failAt === i ? 'on' : ''}`} onClick={() => setFail(i)}>{s.action.split(' ')[0]}</button>)}
        <button type="button" className={`saga-fbtn ok ${failAt === null ? 'on' : ''}`} onClick={() => setFail(null)}>none (success)</button>
      </div>

      <div className="saga-pipeline">
        {ORDER.map((s, i) => {
          const st = statusOf(i);
          return (
            <div key={i} className={`saga-step ${st}`}>
              <span className="saga-act">{s.action}</span>
              <span className="saga-comp">↩ {s.compensation}</span>
              <span className="saga-mark">{st === 'ok' ? '✓' : st === 'failed' ? '✗' : st === 'compensated' ? '↩' : ''}</span>
            </div>
          );
        })}
      </div>

      <div className="saga-steps">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(r.log.length, s + 1))} disabled={step >= r.log.length}>step ▶</button>
        <button type="button" onClick={() => setStep(r.log.length)} disabled={step >= r.log.length}>run all</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
      </div>

      <div className="saga-log">
        {shown.map((e, i) => (
          <div key={i} className={`saga-le ${e.type} ${e.ok ? '' : 'fail'}`}>
            <span className="saga-le-t">{e.type === 'action' ? (e.ok ? 'DO' : 'FAIL') : 'UNDO'}</span>{e.name}
          </div>
        ))}
        {step >= r.log.length && <div className={`saga-outcome ${r.outcome === 'committed' ? 'ok' : 'rb'}`}>{r.outcome === 'committed' ? '✓ committed — all steps succeeded' : '↩ rolled back — every completed step was compensated; the system is consistent again'}</div>}
      </div>

      <p className="saga-foot">
        Each step commits to its own service’s database immediately, so there’s nothing to “roll back” in the ACID sense — the compensation is a
        new transaction that semantically undoes the effect (refund ≠ un-charge, but it’s the business equivalent). The price is that the system is
        briefly in a partial state visible to others (no isolation), so steps must tolerate it and compensations must be <strong>idempotent</strong>
        and effectively always succeed (you can’t compensate a failed compensation — those need retries/alerting). Compare with <strong>two-phase
        commit</strong>, which keeps strict atomicity but holds locks across services and blocks if the coordinator dies — fine within one database,
        untenable across many. Sagas are <em>orchestrated</em> (a central coordinator, like a workflow engine) or <em>choreographed</em> (each
        service emits events the next reacts to). (Garcia-Molina &amp; Salem, 1987.)
      </p>
    </div>
  );
}
