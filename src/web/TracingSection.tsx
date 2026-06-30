// Distributed tracing, made visible. One request fanned out across services becomes a waterfall of
// spans; each bar is positioned by when it started and how long it took, indented by how deep in the
// call tree it sits. The "time by service" bar shows where the latency actually went (self time, which
// partitions the total exactly) — so you optimize the real bottleneck, not a guess. Real model from tracing.ts.
import { useMemo, useState } from 'react';
import { analyze, type Span } from './tracing';

const SPANS: Span[] = [
  { id: 'A', parent: null, service: 'frontend', op: 'GET /checkout', start: 0, duration: 100 },
  { id: 'B', parent: 'A', service: 'auth', op: 'verify token', start: 5, duration: 20 },
  { id: 'C', parent: 'A', service: 'orders-db', op: 'query orders', start: 30, duration: 50 },
  { id: 'D', parent: 'C', service: 'cache', op: 'GET cache', start: 35, duration: 10 },
  { id: 'E', parent: 'C', service: 'orders-db', op: 'exec', start: 48, duration: 30 },
];
const SVC_HUE: Record<string, number> = { frontend: 212, auth: 280, 'orders-db': 0, cache: 150 };
const hue = (s: string) => SVC_HUE[s] ?? 35;

export function TracingSection() {
  const t = useMemo(() => analyze(SPANS), []);
  const [sel, setSel] = useState<string | null>('C');
  const selSpan = SPANS.find((s) => s.id === sel);
  const maxSvc = Math.max(...t.byService.map((x) => x.ms));

  return (
    <div className="trc">
      <div className="trc-wf">
        {t.spans.map((s) => (
          <div key={s.id} className={`trc-row ${sel === s.id ? 'on' : ''}`} onClick={() => setSel(s.id)}>
            <div className="trc-label" style={{ paddingLeft: `${t.depth[s.id] * 16 + 8}px` }}>
              <span className="trc-svc" style={{ background: `hsl(${hue(s.service)} 60% 55%)` }} />{s.op}
            </div>
            <div className="trc-track">
              <div className="trc-bar" style={{ left: `${s.start}%`, width: `${s.duration}%`, background: `hsl(${hue(s.service)} 60% 60%)` }}>
                <span className="trc-dur">{s.duration}ms</span>
              </div>
            </div>
          </div>
        ))}
        <div className="trc-axis"><span>0</span><span>{t.total / 2}ms</span><span>{t.total}ms</span></div>
      </div>

      {selSpan && (
        <div className="trc-detail">
          <span className="trc-d-svc" style={{ color: `hsl(${hue(selSpan.service)} 60% 38%)` }}>{selSpan.service}</span>
          <b>{selSpan.op}</b> · {selSpan.duration}ms total · <b>{t.selfTime[selSpan.id]}ms</b> self · started at {selSpan.start}ms · depth {t.depth[selSpan.id]}
        </div>
      )}

      <div className="trc-services">
        <div className="trc-services-h">where the {t.total}ms went (self time by service — sums to the total)</div>
        {t.byService.map((x) => (
          <div key={x.service} className="trc-svcrow">
            <span className="trc-svcname" style={{ color: `hsl(${hue(x.service)} 60% 38%)` }}>{x.service}</span>
            <div className="trc-svcbar"><div className="trc-svcfill" style={{ width: `${(x.ms / maxSvc) * 100}%`, background: `hsl(${hue(x.service)} 60% 58%)` }} /></div>
            <span className="trc-svcms">{x.ms}ms</span>
          </div>
        ))}
      </div>

      <p className="trc-foot">
        The waterfall makes serial-vs-parallel obvious (auth and the DB query here overlap; the cache and exec inside the DB span are
        sequential) and the self-time breakdown points straight at <strong>orders-db</strong> as the place to optimize — a flame graph is the
        same data aggregated across many traces. The trick that makes it work across machines is <strong>context propagation</strong>: every hop
        forwards the trace id and its parent span id (the W3C <code>traceparent</code> header), so independently-recorded spans stitch back into
        one tree. Pair traces with metrics (the SLO/latency numbers) and logs (the per-event detail) — the “three pillars” — and a sampling
        strategy so you keep the interesting traces without storing every request. (Dapper; OpenTelemetry.)
      </p>
    </div>
  );
}
