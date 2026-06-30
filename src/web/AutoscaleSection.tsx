// Horizontal autoscaling (HPA), made visible. A load series drives the replica count through the HPA
// formula ceil(replicas × metric/target); step through it and watch replicas chase load — scaling up
// instantly, and scaling down only after the stabilization window rides out brief dips. The per-replica
// utilization bar shows the metric the autoscaler is steering back to target. Real model from autoscale.ts.
import { useMemo, useState } from 'react';
import { simulate, type HpaOpts } from './autoscale';

export function AutoscaleSection() {
  const [loadStr, setLoadStr] = useState('100,100,300,500,500,80,80,400');
  const [target, setTarget] = useState(100);
  const [maxR, setMaxR] = useState(8);
  const [downDelay, setDownDelay] = useState(2);
  const [step, setStep] = useState(0);

  const loads = useMemo(() => loadStr.split(',').map((s) => Math.max(0, parseInt(s.trim(), 10) || 0)).slice(0, 14), [loadStr]);
  const opts: HpaOpts = { target, min: 1, max: maxR, tolerance: 0.1 };
  const sim = useMemo(() => simulate(loads, 2, opts, downDelay), [loads, target, maxR, downDelay]);
  const cur = sim[Math.min(step, sim.length - 1)];
  const maxLoad = Math.max(1, ...loads);

  const ratio = cur ? cur.perReplica / target : 1;

  return (
    <div className="hpa">
      <div className="hpa-controls">
        <label>load series <input value={loadStr} spellCheck={false} onChange={(e) => { setLoadStr(e.target.value); setStep(0); }} /></label>
        <label>target/replica <input type="range" min={50} max={200} step={10} value={target} onChange={(e) => setTarget(+e.target.value)} /><b>{target}</b></label>
        <label>max replicas <input type="range" min={2} max={12} value={maxR} onChange={(e) => setMaxR(+e.target.value)} /><b>{maxR}</b></label>
        <label>scale-down delay <input type="range" min={1} max={4} value={downDelay} onChange={(e) => setDownDelay(+e.target.value)} /><b>{downDelay} ticks</b></label>
      </div>

      <div className="hpa-chart">
        {sim.map((s, i) => (
          <div key={i} className={`hpa-col ${i === step ? 'cur' : ''}`} onClick={() => setStep(i)}>
            <div className="hpa-bars">
              <div className="hpa-load" style={{ height: `${(s.load / maxLoad) * 100}%` }} title={`load ${s.load}`} />
            </div>
            <div className="hpa-reps" title={`${s.replicas} replicas`}>{Array.from({ length: s.replicas }, (_, k) => <span key={k} className="hpa-rep" />)}</div>
            <div className="hpa-tnum">{s.t}</div>
          </div>
        ))}
      </div>

      <div className="hpa-readout">
        <div className="hpa-now">
          <span className="hpa-rlabel">tick {cur?.t}</span>
          <span>load <b>{cur?.load}</b></span>
          <span>÷ {cur?.replicas} replicas =</span>
          <span className={`hpa-util ${ratio > 1.1 ? 'high' : ratio < 0.9 ? 'low' : 'ok'}`}>{Math.round(cur?.perReplica ?? 0)}/replica</span>
          <span className="hpa-vs">vs target {target}</span>
        </div>
        <div className="hpa-formula">
          desired = ceil({cur?.replicas} × {Math.round(cur?.perReplica ?? 0)}/{target}) = <b>{cur?.desired}</b>
          <span className={`hpa-action ${cur?.action.replace(' ', '')}`}>{cur?.action === 'scale up' ? '▲ scale up' : cur?.action === 'scale down' ? '▼ scale down' : '＝ hold'}</span>
        </div>
      </div>

      <div className="hpa-steps">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(sim.length - 1, s + 1))} disabled={step >= sim.length - 1}>step ▶</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
      </div>

      <p className="hpa-foot">
        The replica count cancels in the formula, so the HPA really chases <strong>total load ÷ per-replica target</strong> — but the ratio form
        lets any signal drive it (CPU, requests/sec, queue length, even a custom business metric). Two guards stop it flapping: a
        <strong> tolerance</strong> dead-band (ignore deviations under ~10%) and a scale-<em>down</em> <strong>stabilization window</strong> — scale
        up fast, scale down slow, so a brief dip doesn’t tear down capacity you need back seconds later. It can only add pods if the cluster has
        room, which is where the <em>cluster autoscaler</em> (adding nodes) and, lately, scale-to-zero serverless pick up. Pair it with the right
        readiness probe so new pods only take traffic once warm. (Kubernetes HPA.)
      </p>
    </div>
  );
}
