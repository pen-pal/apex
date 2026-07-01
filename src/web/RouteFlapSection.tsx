// BGP route flap damping, made visible. Pick a route's behaviour and watch its penalty rise on each flap and
// decay exponentially between them, against the suppress (2000) and reuse (750) thresholds. When the penalty
// crosses suppress the route is withheld (shaded red) until it decays back below reuse — the hysteresis gap that
// stops it oscillating. Real model from routeflap.ts.
import { useMemo, useState } from 'react';
import { simulate, flapEvery, DEFAULTS } from './routeflap';

const DURATION = 3600, DT = 30;
const SCENARIOS: { name: string; flaps: number[] }[] = [
  { name: 'stable (one blip)', flaps: [120] },
  { name: 'occasional flaps', flaps: [120, 900, 1800, 2700] },
  { name: 'chronic flapping', flaps: flapEvery(45, 360) },
];

export function RouteFlapSection() {
  const [sc, setSc] = useState(SCENARIOS[2]);
  const r = useMemo(() => simulate(sc.flaps, DURATION, DT, DEFAULTS), [sc]);

  const W = 620, H = 240, PL = 40, PB = 26, PT = 12, PR = 12;
  const yMax = Math.max(DEFAULTS.suppress * 1.2, ...r.series.map((p) => p.penalty)) * 1.05;
  const px = (t: number) => PL + (t / DURATION) * (W - PL - PR);
  const py = (v: number) => H - PB - (v / yMax) * (H - PB - PT);
  const line = r.series.map((p) => `${px(p.t).toFixed(1)},${py(p.penalty).toFixed(1)}`).join(' ');

  // contiguous suppressed intervals for shading
  const intervals: [number, number][] = [];
  let start = -1;
  r.series.forEach((p, i) => {
    if (p.suppressed && start < 0) start = p.t;
    if (!p.suppressed && start >= 0) { intervals.push([start, p.t]); start = -1; }
    if (i === r.series.length - 1 && start >= 0) intervals.push([start, p.t]);
  });
  const last = r.series[r.series.length - 1];

  return (
    <div className="rfd">
      <p className="rfd-intro">
        A "flapping" route (repeatedly withdrawn and re-announced) forces every router that hears it to recompute
        paths — one bad link can burn CPU worldwide. Damping gives each route a <strong>penalty</strong>: +1000
        per flap, decaying with a 15-minute half-life. Above the <strong>suppress</strong> threshold the route is
        withheld; it returns only after decaying below the lower <strong>reuse</strong> threshold. Pick a route:
      </p>

      <div className="rfd-presets">
        {SCENARIOS.map((s) => <button key={s.name} type="button" className={`rfd-preset ${sc.name === s.name ? 'on' : ''}`} onClick={() => setSc(s)}>{s.name}</button>)}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="rfd-chart">
        {intervals.map(([a, b], i) => <rect key={i} x={px(a)} y={PT} width={px(b) - px(a)} height={H - PB - PT} className="rfd-supp" />)}
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} className="rfd-axis" />
        <line x1={PL} y1={PT} x2={PL} y2={H - PB} className="rfd-axis" />
        <line x1={PL} y1={py(DEFAULTS.suppress)} x2={W - PR} y2={py(DEFAULTS.suppress)} className="rfd-thresh sup" />
        <text x={W - PR} y={py(DEFAULTS.suppress) - 3} className="rfd-tlabel sup" textAnchor="end">suppress {DEFAULTS.suppress}</text>
        <line x1={PL} y1={py(DEFAULTS.reuse)} x2={W - PR} y2={py(DEFAULTS.reuse)} className="rfd-thresh reu" />
        <text x={W - PR} y={py(DEFAULTS.reuse) - 3} className="rfd-tlabel reu" textAnchor="end">reuse {DEFAULTS.reuse}</text>
        {r.series.filter((p) => p.flap).map((p, i) => <line key={i} x1={px(p.t)} y1={H - PB} x2={px(p.t)} y2={H - PB + 5} className="rfd-flap" />)}
        <polyline points={line} className="rfd-curve" />
        <text x={PL - 5} y={py(yMax * 0.9)} className="rfd-axl" textAnchor="end">penalty</text>
        <text x={W - PR} y={H - 4} className="rfd-axl" textAnchor="end">time (1 hour) →</text>
      </svg>

      <div className={`rfd-state ${last.suppressed ? 'bad' : 'ok'}`}>
        route is currently <b>{last.suppressed ? 'SUPPRESSED (withheld)' : 'in use'}</b> · penalty {Math.round(last.penalty)}
      </div>

      <div className="rfd-stats">
        <div className="rfd-stat"><span>flaps</span><b>{sc.flaps.length}</b></div>
        <div className="rfd-stat"><span>peak penalty</span><b>{Math.round(Math.max(...r.series.map((p) => p.penalty)))}</b></div>
        <div className={`rfd-stat ${r.suppressedFor > 0 ? 'warn' : 'ok'}`}><span>time suppressed</span><b>{Math.round(r.suppressedFor / 60)} min</b></div>
      </div>

      <p className="rfd-foot">
        The design is a feedback controller for stability: exponential decay means good behaviour is forgiven
        quickly, while the fixed per-flap penalty means bad behaviour compounds — flap faster than the half-life
        and the penalty runs away. The <strong>hysteresis gap</strong> between suppress (2000) and reuse (750) is
        the key detail: a single threshold would let a route right at the line toggle in and out of service every
        few seconds, which is itself a kind of flapping; the gap forces a route to prove it's been stable for a
        good while before it's trusted again. Real implementations also cap the maximum suppress time so a route
        can't be penalized forever, and tune the constants per prefix importance. There's a famous catch, though:
        damping can <em>overreact</em>. Because BGP path exploration makes a single real event look like several
        flaps as routers try alternate paths, aggressive damping was found to suppress <em>stable</em> routes and
        actually <strong>slow</strong> global convergence — so RIPE recommended turning it off for years, and only
        gentler, well-tuned parameters (RFC 7196) brought it back. It's a clean example of a stability mechanism
        whose second-order effects matter as much as its first-order goal — the same tension you see in retry
        backoff, circuit breakers, and autoscaling. (RFC 2439; RFC 7196.)
      </p>
    </div>
  );
}
