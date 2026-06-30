// Graceful shutdown, made visible. SIGTERM lands at t=0; the timeline shows each request as a bar and
// two markers — the readiness window (new requests still arrive until the LB notices) and the grace
// period (force-kill deadline). Drag the grace period down toward zero and watch in-flight bars turn
// red (dropped); give it more than the longest request and everything drains green. Real model from shutdown.ts.
import { useMemo, useState } from 'react';
import { shutdown, type Req } from './shutdown';

const REQS: Req[] = [
  { id: 'r1', arrival: -2, duration: 3 }, { id: 'r2', arrival: -1, duration: 5 },
  { id: 'r3', arrival: 1, duration: 2 }, { id: 'r4', arrival: 3, duration: 2 }, { id: 'r5', arrival: -3, duration: 12 },
];
const OUTCOME_HUE = { completed: 150, dropped: 0, rejected: 220 } as const;

export function GracefulShutdownSection() {
  const [readiness, setReadiness] = useState(2);
  const [grace, setGrace] = useState(10);

  const r = useMemo(() => shutdown(REQS, readiness, grace), [readiness, grace]);
  const tMin = Math.min(0, ...REQS.map((q) => q.arrival));
  const tMax = Math.max(grace, ...r.results.map((q) => q.finish)) + 1;
  const X = (t: number) => `${((t - tMin) / (tMax - tMin)) * 100}%`;

  return (
    <div className="gsd">
      <div className="gsd-controls">
        <label>readiness propagation <input type="range" min={0} max={6} value={readiness} onChange={(e) => setReadiness(+e.target.value)} /><b>{readiness}</b></label>
        <label>grace period <input type="range" min={0} max={14} value={grace} onChange={(e) => setGrace(+e.target.value)} /><b>{grace}</b></label>
      </div>

      <div className="gsd-timeline">
        <div className="gsd-window" style={{ left: X(0), width: `${(readiness / (tMax - tMin)) * 100}%` }} title="readiness window — new requests still routed here" />
        <div className="gsd-mark sigterm" style={{ left: X(0) }}><span>SIGTERM</span></div>
        <div className="gsd-mark kill" style={{ left: X(grace) }}><span>force-kill</span></div>
        {r.results.map((q, i) => (
          <div key={q.id} className="gsd-lane" style={{ top: `${34 + i * 26}px` }}>
            <div className="gsd-bar" style={{ left: X(q.arrival), width: `${((q.finish - q.arrival) / (tMax - tMin)) * 100}%`, background: `hsl(${OUTCOME_HUE[q.outcome]} ${q.outcome === 'rejected' ? '0%' : '60%'} ${q.outcome === 'rejected' ? '78%' : '58%'})` }}>
              <span className="gsd-blabel">{q.id}</span>
            </div>
          </div>
        ))}
        <div className="gsd-spacer" style={{ height: `${44 + REQS.length * 26}px` }} />
      </div>

      <div className="gsd-stats">
        <div className="gsd-stat ok"><span>completed</span><b>{r.completed}</b></div>
        <div className="gsd-stat bad"><span>dropped (5xx)</span><b>{r.dropped}</b></div>
        <div className="gsd-stat"><span>rejected (re-routed)</span><b>{r.rejected}</b></div>
        <div className={`gsd-stat ${r.cleanExit ? 'clean' : 'dirty'}`}><span>exit</span><b>{r.cleanExit ? 'clean ✓' : 'dropped conns ✗'}</b></div>
      </div>
      <div className="gsd-hint">drain needed: <b>{r.drainNeeded}</b> ticks — set the grace period at least that high for a clean shutdown.</div>

      <p className="gsd-foot">
        The sequence matters: fail <strong>readiness</strong> first so traffic stops arriving, THEN drain. Skip the readiness step and you keep
        getting new requests right up to the moment you exit. Set the <strong>grace period</strong> below your longest request and the orchestrator
        SIGKILLs you mid-flight, turning a routine restart into a burst of errors — which is exactly what makes a careless rolling deploy or a
        scale-down visible to users. Long-lived connections (WebSockets, streaming, big uploads) need either a generous budget or app-level
        draining (a <code>preStop</code> hook, refusing keep-alive, closing idle sockets). It’s the unglamorous half of every zero-downtime claim. (Kubernetes pod lifecycle.)
      </p>
    </div>
  );
}
