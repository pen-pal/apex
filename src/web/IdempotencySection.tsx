// Idempotency keys, made visible. The same scenario — a client charges $100, the response is lost, the
// client retries — runs down two paths at once. WITHOUT an idempotency key the retry charges again
// ($200, double charge); WITH a key the server recognizes the retry and replays the stored result, so
// the customer is charged exactly once. Step through it and watch the two totals diverge. Real service
// from idempotency.ts.
import { useMemo, useState } from 'react';
import { PaymentService } from './idempotency';

interface Line { text: string; outcome: string }

export function IdempotencySection() {
  const [step, setStep] = useState(0);

  // recompute both services deterministically from the step count
  const { noKey, keyed } = useMemo(() => {
    const noKeySvc = new PaymentService();
    const keyedSvc = new PaymentService();
    const noLog: Line[] = [];
    const keyLog: Line[] = [];
    const KEY = 'idem-7f3a';
    if (step >= 1) {
      const a = noKeySvc.handle(null, 100); noLog.push({ text: 'POST /charge $100', outcome: a.outcome });
      const b = keyedSvc.handle(KEY, 100); keyLog.push({ text: `POST /charge $100  (Idempotency-Key: ${KEY})`, outcome: b.outcome });
    }
    if (step >= 2) {
      const a = noKeySvc.handle(null, 100); noLog.push({ text: 'response lost → client RETRIES $100', outcome: a.outcome });
      const b = keyedSvc.handle(KEY, 100); keyLog.push({ text: `response lost → client RETRIES (same key)`, outcome: b.outcome });
    }
    return { noKey: { svc: noKeySvc, log: noLog }, keyed: { svc: keyedSvc, log: keyLog } };
  }, [step]);

  const labelStep = ['—', 'client sends the charge', 'the response is lost, so the client retries'][step] ?? '';
  const badge = (o: string) => o === 'charged' || o === 'charged-unsafe' ? 'charge' : o === 'replayed' ? 'replay' : o;

  return (
    <div className="idm">
      <div className="idm-steps">
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(2, s + 1))} disabled={step >= 2}>{step === 0 ? 'send charge ▶' : step === 1 ? 'retry (response lost) ▶' : 'done'}</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
        <span className="idm-steplabel">{labelStep}</span>
      </div>

      <div className="idm-paths">
        {([['without idempotency key', noKey, false], ['with idempotency key', keyed, true]] as const).map(([title, path, safe]) => {
          const overcharged = path.svc.total > 100;
          return (
            <div key={title} className={`idm-path ${safe ? 'safe' : 'unsafe'}`}>
              <div className="idm-path-h">{title}</div>
              <div className="idm-reqs">
                {path.log.length === 0 ? <div className="idm-empty">press “send charge”</div> : path.log.map((l, i) => (
                  <div key={i} className="idm-req">
                    <span className="idm-rtext">{l.text}</span>
                    <span className={`idm-badge ${badge(l.outcome)}`}>{l.outcome === 'replayed' ? '↩ replayed (no charge)' : l.outcome === 'conflict' ? 'conflict' : '$ charged'}</span>
                  </div>
                ))}
              </div>
              <div className={`idm-total ${overcharged ? 'bad' : path.svc.total > 0 ? 'ok' : ''}`}>
                charged <b>${path.svc.total}</b> · {path.svc.charges} time{path.svc.charges === 1 ? '' : 's'}
                {overcharged && <span className="idm-warn"> ⚠ DOUBLE CHARGE</span>}
                {safe && path.svc.total === 100 && step >= 2 && <span className="idm-good"> ✓ exactly once</span>}
              </div>
            </div>
          );
        })}
      </div>

      <p className="idm-foot">
        The network only promises <strong>at-least-once</strong> delivery — a lost response is indistinguishable from a lost request, so clients
        must retry, and retries are unavoidable. An idempotency key lets the server turn that into <strong>exactly-once effect</strong>: it records
        the result under the key the first time and replays it on any retry, so the money moves once. The server must claim the key
        <em> before</em> doing the work (so a concurrent duplicate gets a conflict, not a second charge) and keep the record long enough to cover
        retries. GET/PUT/DELETE are naturally idempotent; it’s POST-style “create/charge/send” operations that need this. It’s the API-layer
        cousin of TCP’s dedup-by-sequence-number and a database’s unique constraint. (Stripe API; IETF idempotency-key draft.)
      </p>
    </div>
  );
}
