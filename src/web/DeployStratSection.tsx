// Deployment strategies, made visible. Pick a strategy and step through the rollout: the fleet flips
// from v1 to v2, the router splits traffic, and the availability meter shows whether users feel anything.
// Recreate flashes red (downtime); rolling dips capacity while both versions serve; blue-green flips
// atomically at full capacity; canary trickles traffic to one instance first. Real model from deploystrat.ts.
import { useMemo, useState } from 'react';
import { simulate, availability, minAvailability, STRATEGY_LABEL, type Strategy, type Version } from './deploystrat';

const STRATS: Strategy[] = ['recreate', 'rolling', 'bluegreen', 'canary'];
const TAG: Record<Strategy, string> = { recreate: 'simplest · has downtime', rolling: 'zero-downtime · mixed versions', bluegreen: 'instant cutover · needs 2× capacity', canary: 'safest · slowest' };
const VCOLOR: Record<Version, string> = { v1: 'hsl(212 60% 60%)', v2: 'hsl(150 50% 50%)', down: 'hsl(0 0% 80%)' };

export function DeployStratSection() {
  const [strategy, setStrategy] = useState<Strategy>('canary');
  const [step, setStep] = useState(0);
  const n = 4;

  const steps = useMemo(() => simulate(strategy, n, 1), [strategy]);
  const cur = steps[Math.min(step, steps.length - 1)];
  const avail = availability(cur);
  const pick = (s: Strategy) => { setStrategy(s); setStep(0); };

  return (
    <div className="dpl">
      <div className="dpl-strats">
        {STRATS.map((s) => (
          <button key={s} type="button" className={`dpl-strat ${strategy === s ? 'on' : ''}`} onClick={() => pick(s)}>
            <span className="dpl-sname">{STRATEGY_LABEL[s]}</span>
            <span className="dpl-stag">{TAG[s]}</span>
          </button>
        ))}
      </div>

      <div className="dpl-stage">
        <div className="dpl-fleet-wrap">
          <div className="dpl-router">
            <span className="dpl-router-h">traffic</span>
            <div className="dpl-split">
              <div className="dpl-split-v1" style={{ width: `${100 - cur.trafficV2}%` }}>{100 - cur.trafficV2 > 8 && `v1 ${100 - cur.trafficV2}%`}</div>
              <div className="dpl-split-v2" style={{ width: `${cur.trafficV2}%` }}>{cur.trafficV2 > 8 && `v2 ${cur.trafficV2}%`}</div>
            </div>
          </div>
          <div className="dpl-fleet">
            {cur.instances.map((v, i) => (
              <div key={i} className="dpl-inst" style={{ background: VCOLOR[v], opacity: v === 'down' ? 0.5 : 1 }}>
                {v === 'down' ? '⏻' : v}
              </div>
            ))}
          </div>
          <div className={`dpl-avail ${avail === 0 ? 'down' : avail < 100 ? 'partial' : 'ok'}`}>
            availability <b>{avail}%</b>{avail === 0 && ' — DOWNTIME'}
          </div>
        </div>
      </div>

      <div className="dpl-phase">step {step + 1}/{steps.length}: {cur.phase}</div>

      <div className="dpl-steps">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀ back</button>
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step >= steps.length - 1}>{step >= steps.length - 1 ? 'rolled out' : 'next ▶'}</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>restart</button>
      </div>

      <div className="dpl-compare">
        <div className="dpl-compare-h">at a glance</div>
        <table className="dpl-ctable">
          <thead><tr><th>strategy</th><th>min availability</th><th>extra capacity</th><th>rollback</th></tr></thead>
          <tbody>
            {STRATS.map((s) => {
              const md = minAvailability(simulate(s, n, 1));
              const cap = s === 'bluegreen' ? '2×' : s === 'rolling' ? '~1 batch' : '1×';
              const rb = s === 'bluegreen' ? 'instant (flip back)' : s === 'canary' ? 'fast (stop ramp)' : s === 'recreate' ? 'redeploy v1 (downtime)' : 'roll back the batches';
              return (
                <tr key={s} className={s === strategy ? 'on' : ''}>
                  <td><button type="button" className="dpl-clink" onClick={() => pick(s)}>{STRATEGY_LABEL[s]}</button></td>
                  <td className={md === 0 ? 'bad' : ''}>{md}%</td><td>{cap}</td><td>{rb}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="dpl-foot">
        There's no universally best choice — it's a trade between <strong>risk, speed, and cost</strong>. <strong>Canary</strong> catches a bad
        release before most users see it, which is why it's the default for high-traffic services (often automated on error-rate/latency SLOs).
        <strong> Blue-green</strong> buys the cleanest rollback at the price of double infrastructure. <strong>Rolling</strong> is the zero-extra-cost
        workhorse but forces v1 and v2 to be wire-compatible (and the database to be migrated in backward-compatible steps). <strong>Recreate</strong>
        is fine for a stateful singleton or a maintenance window. Feature flags add another axis — ship the code dark, then turn it on for a cohort
        independently of the deploy. (Humble &amp; Farley; Google SRE.)
      </p>
    </div>
  );
}
