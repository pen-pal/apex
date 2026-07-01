// The bulkhead pattern, made visible. Three downstream dependencies share your service's thread pool. Drag
// dependency C's latency up (it's getting sick) and watch the two designs diverge: with ONE shared pool, C's
// slow requests pile up and consume every slot, so healthy A and B go down too — a total outage from one bad
// dependency. With BULKHEADS (each dependency capped to its own compartment), C can only exhaust its own
// slots; A and B keep serving. Real model from bulkhead.ts.
import { useState } from 'react';
import { analyze, type Dep } from './bulkhead';

const POOL = 12;

function DepRow({ name, demand, cap, healthy, saturated }: { name: string; demand: number; cap: number; healthy: boolean; saturated?: boolean }) {
  const bad = saturated ?? !healthy;
  const fill = Math.min(100, (demand / cap) * 100);
  return (
    <div className={`blk-dep ${bad ? 'down' : 'up'}`}>
      <span className="blk-dname">{name}</span>
      <div className="blk-dbar"><div className="blk-dfill" style={{ width: `${fill}%` }} /></div>
      <span className="blk-dstat">{bad ? '✕ down' : '✓ ok'}</span>
    </div>
  );
}

export function BulkheadSection() {
  const [cLatency, setCLatency] = useState(50);
  const deps: Dep[] = [
    { name: 'A', rate: 20, latencyMs: 50 },
    { name: 'B', rate: 30, latencyMs: 50 },
    { name: 'C', rate: 20, latencyMs: cLatency },
  ];
  const r = analyze(deps, POOL);
  const sharedDown = r.shared.deps.filter((d) => !d.healthy).length;
  const bulkDown = r.bulkhead.deps.filter((d) => !d.healthy).map((d) => d.name);

  return (
    <div className="blk">
      <p className="blk-intro">
        Your service calls three dependencies from a bounded pool of <strong>{POOL} threads</strong>. Slots in
        use follow Little's law — a dependency at <em>rate × latency</em> holds that many slots. Drag
        <strong> C's latency</strong> up (it's getting sick) and compare a single shared pool to per-dependency
        bulkheads:
      </p>

      <label className="blk-slider">
        <span>dependency C latency <b>{cLatency} ms</b> {cLatency >= 500 && <em className="blk-sick">↑ C is sick</em>}</span>
        <input type="range" min={50} max={3000} step={50} value={cLatency} onChange={(e) => setCLatency(+e.target.value)} />
      </label>

      <div className="blk-panels">
        <div className={`blk-panel ${r.shared.saturated ? 'bad' : 'ok'}`}>
          <div className="blk-ptitle">one shared pool</div>
          <div className="blk-pool">
            <div className="blk-pooltrack"><div className={`blk-poolfill ${r.shared.saturated ? 'sat' : ''}`} style={{ width: `${Math.min(100, (r.shared.totalDemand / POOL) * 100)}%` }} /></div>
            <span className="blk-poolnum">{r.shared.totalDemand.toFixed(1)} / {POOL} slots{r.shared.saturated ? ' — FULL' : ''}</span>
          </div>
          {r.shared.deps.map((d) => <DepRow key={d.name} name={d.name} demand={d.demand} cap={POOL} healthy={d.healthy} saturated={r.shared.saturated} />)}
          <div className={`blk-note ${r.shared.saturated ? 'bad' : 'ok'}`}>{r.shared.saturated ? `⚠ pool full — all ${sharedDown} dependencies starved. Total outage from one sick dependency.` : 'healthy — everyone gets slots'}</div>
        </div>

        <div className={`blk-panel ${bulkDown.length ? 'part' : 'ok'}`}>
          <div className="blk-ptitle">bulkheads (cap {r.bulkhead.capPerDep}/dep)</div>
          {r.bulkhead.deps.map((d) => <DepRow key={d.name} name={d.name} demand={d.demand} cap={r.bulkhead.capPerDep} healthy={d.healthy} />)}
          <div className={`blk-note ${bulkDown.length ? 'part' : 'ok'}`}>{bulkDown.length ? `✓ contained — only ${bulkDown.join(', ')} degraded; the rest keep serving.` : 'healthy — everyone within their compartment'}</div>
        </div>
      </div>

      <p className="blk-foot">
        The tradeoff is real: splitting one pool of {POOL} into three caps of {r.bulkhead.capPerDep} means no
        single dependency can borrow idle capacity from the others, so you lose a little peak throughput and can
        throttle a dependency that a shared pool would have absorbed. You buy <strong>blast-radius
        containment</strong> for it — the difference between "one dependency is slow" and "we're down." In
        practice bulkheads are separate thread pools or connection pools per dependency (Hystrix, resilience4j),
        and they pair with <strong>timeouts</strong> (so a slot doesn't stay held forever) and a
        <strong> circuit breaker</strong> (so once C is clearly dead you stop spending slots on it at all). The
        same idea scales up: separate clusters per tenant, per-queue consumers, cell-based architecture — flood
        one cell, the rest float. (Nygard, "Release It!")
      </p>
    </div>
  );
}
