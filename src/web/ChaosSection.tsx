// Chaos engineering, made visible. Click a service to kill it and watch the failure cascade through the
// dependency graph — red = down, orange = degraded (still responding via a fallback), green = up. Flip a
// service's resilience shield on and watch the blast radius shrink: a hard dependency drags its callers
// down, a resilient one absorbs the failure. Real propagation from chaos.ts.
import { useMemo, useState } from 'react';
import { evaluate, type Service, type Status } from './chaos';

const POS: Record<string, { x: number; y: number }> = {
  frontend: { x: 205, y: 38 }, orders: { x: 110, y: 135 }, recs: { x: 300, y: 135 }, db: { x: 110, y: 232 }, ml: { x: 300, y: 232 },
};
const EDGES: [string, string][] = [['frontend', 'orders'], ['frontend', 'recs'], ['orders', 'db'], ['recs', 'ml']];
const SCOLOR: Record<Status, string> = { up: 'hsl(150 50% 50%)', degraded: 'hsl(35 85% 55%)', down: 'hsl(0 70% 56%)' };

export function ChaosSection() {
  const [failed, setFailed] = useState<string | null>('db');
  const [resilient, setResilient] = useState<Record<string, boolean>>({ recs: true });

  const services: Service[] = useMemo(() => [
    { id: 'db', deps: [], resilient: !!resilient.db },
    { id: 'ml', deps: [], resilient: !!resilient.ml },
    { id: 'orders', deps: ['db'], resilient: !!resilient.orders },
    { id: 'recs', deps: ['ml'], resilient: !!resilient.recs },
    { id: 'frontend', deps: ['orders', 'recs'], resilient: !!resilient.frontend },
  ], [resilient]);

  const r = useMemo(() => evaluate(services, failed), [services, failed]);
  const ids = Object.keys(POS);
  const userImpact = r.status['frontend'];

  return (
    <div className="chs">
      <div className="chs-stage">
        <svg viewBox="0 0 410 290" className="chs-svg">
          <defs><marker id="chs-a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--muted)" /></marker></defs>
          {EDGES.map(([a, b], i) => {
            const p = POS[a], q = POS[b];
            const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
            return <line key={i} x1={p.x + ux * 30} y1={p.y + uy * 30} x2={q.x - ux * 30} y2={q.y - uy * 30} className="chs-edge" markerEnd="url(#chs-a)" />;
          })}
          {ids.map((id) => {
            const p = POS[id], st = r.status[id];
            return (
              <g key={id} className="chs-node" onClick={() => setFailed((f) => (f === id ? null : id))} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r={28} style={{ fill: `${SCOLOR[st]}`, opacity: st === 'degraded' ? 0.85 : 1 }} className={failed === id ? 'chs-failed' : ''} />
                <text x={p.x} y={p.y - 1} className="chs-nl">{id}</text>
                <text x={p.x} y={p.y + 11} className="chs-ns">{failed === id ? '💥' : st}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="chs-resil">
        <span className="chs-resil-h">resilience (fallback / timeout):</span>
        {ids.map((id) => (
          <label key={id} className="chs-rtoggle"><input type="checkbox" checked={!!resilient[id]} onChange={(e) => setResilient((rs) => ({ ...rs, [id]: e.target.checked }))} />{id}</label>
        ))}
      </div>

      <div className="chs-radius">
        <div className={`chs-impact ${userImpact}`}>user-facing (frontend): <b>{userImpact === 'up' ? 'UP ✓' : userImpact === 'degraded' ? 'DEGRADED' : 'DOWN ✗'}</b></div>
        <div className="chs-counts">
          blast radius: <b>{r.down.length}</b> down{r.down.length ? ` (${r.down.join(', ')})` : ''}{r.degraded.length ? ` · ${r.degraded.length} degraded (${r.degraded.join(', ')})` : ''}
        </div>
        <div className="chs-hint">click a service to inject a failure there; toggle a resilience shield to contain it.</div>
      </div>

      <p className="chs-foot">
        The point of a chaos experiment isn’t to break things for fun — it’s to <strong>falsify a hypothesis</strong>: “if ml dies, only
        recommendations degrade.” Inject the failure in production (small blast radius, business hours, a kill switch ready) and see whether the
        real system matches. Hard dependencies are where one failure becomes everyone’s failure, so the work is turning them into
        <strong> resilient</strong> ones — fallbacks, cached defaults, timeouts, circuit breakers — until the user-facing surface survives any
        single backend dying. Netflix runs this continuously (Chaos Monkey randomly kills instances) precisely so the resilience is exercised
        before a real outage finds the gap. Pair it with the SLO/error-budget policy so you only run experiments when you can afford them. (Principles of Chaos; Google SRE.)
      </p>
    </div>
  );
}
