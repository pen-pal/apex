// Liveness vs readiness probes, made visible. Pick a scenario and step the probe cycles: watch readiness
// pull the pod out of the load balancer (no restart) while liveness, after enough consecutive failures,
// kills and restarts it. The anti-pattern scenario shows why a slow-under-load check on the LIVENESS
// probe causes a restart storm — the same failures on the readiness probe just shed traffic. Real state
// machine from healthcheck.ts.
import { useMemo, useState } from 'react';
import { run, type Tick } from './healthcheck';

const P = (l: 'pass' | 'fail', r: 'pass' | 'fail'): Tick => ({ liveness: l, readiness: r });
const SCENARIOS: Record<string, Tick[]> = {
  'healthy': [P('pass', 'pass'), P('pass', 'pass'), P('pass', 'pass')],
  'warming up': [P('pass', 'fail'), P('pass', 'fail'), P('pass', 'pass'), P('pass', 'pass')],
  'deadlock → restart': [P('pass', 'pass'), P('fail', 'fail'), P('fail', 'fail'), P('fail', 'fail'), P('pass', 'pass')],
  'anti-pattern: slow on liveness': [P('pass', 'pass'), P('fail', 'fail'), P('fail', 'fail'), P('fail', 'fail'), P('fail', 'fail'), P('fail', 'fail'), P('fail', 'fail')],
};

export function HealthCheckSection() {
  const [scenario, setScenario] = useState('deadlock → restart');
  const [step, setStep] = useState(0);
  const ticks = SCENARIOS[scenario];
  const results = useMemo(() => run(ticks, 3), [ticks]);
  const cur = step === 0 ? null : results[step - 1];
  const state = cur?.state ?? run([], 3)[0]?.state ?? { phase: 'starting' as const, ready: false, serving: false, livenessFails: 0, restarts: 0 };

  const pick = (s: string) => { setScenario(s); setStep(0); };
  const tone = state.serving ? 'serving' : state.phase === 'starting' && state.restarts > 0 ? 'restarting' : 'unready';

  return (
    <div className="hlth">
      <div className="hlth-scenarios">
        {Object.keys(SCENARIOS).map((s) => (
          <button key={s} type="button" className={`hlth-scn ${scenario === s ? 'on' : ''}`} onClick={() => pick(s)}>{s}</button>
        ))}
      </div>

      <div className="hlth-timeline">
        {ticks.map((t, i) => (
          <div key={i} className={`hlth-tick ${i === step - 1 ? 'cur' : ''} ${i < step ? 'done' : ''}`}>
            <span className={`hlth-pp ${t.liveness}`} title="liveness">L</span>
            <span className={`hlth-pp ${t.readiness}`} title="readiness">R</span>
          </div>
        ))}
      </div>

      <div className="hlth-stage">
        <div className="hlth-lb">load<br />balancer</div>
        <div className={`hlth-arrow ${state.serving ? 'on' : 'off'}`}>{state.serving ? '──▶' : '──╳'}</div>
        <div className={`hlth-pod ${tone}`}>
          <div className="hlth-pod-state">{state.serving ? 'READY' : state.phase === 'starting' ? 'STARTING' : 'NOT READY'}</div>
          <div className="hlth-pod-sub">{state.serving ? 'in rotation' : 'out of rotation'}</div>
          <div className="hlth-badges">
            <span className="hlth-badge">restarts: <b>{state.restarts}</b></span>
            <span className="hlth-badge">liveness fails: <b>{state.livenessFails}/3</b></span>
          </div>
        </div>
      </div>

      <div className="hlth-note">{step === 0 ? 'Press step to run the probe cycles. Watch which probe gates traffic and which one restarts the pod.' : cur?.note}</div>

      <div className="hlth-steps">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(ticks.length, s + 1))} disabled={step >= ticks.length}>{step >= ticks.length ? 'done' : 'step ▶'}</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
      </div>

      <p className="hlth-foot">
        Same failing check, opposite consequences: on the <strong>readiness</strong> probe it removes the pod from the load balancer until it
        recovers; on the <strong>liveness</strong> probe it eventually <strong>kills and restarts</strong> the container. So put “am I overloaded /
        warming up / waiting on a dependency?” on readiness (shed traffic, don’t restart), and reserve liveness for a true unrecoverable wedge.
        The famous outage shape is a liveness probe that times out when the app is merely slow under load: every replica fails it at once and
        Kubernetes restarts the whole fleet, deepening the overload into a crashloop. A <strong>startup probe</strong> adds a grace period so slow
        boots don’t trip liveness. (Kubernetes probe docs; Google SRE.)
      </p>
    </div>
  );
}
