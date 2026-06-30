// Load shedding, made visible. Same overload, two servers: one with a bounded queue that sheds the
// excess, one that queues everything. The queue chart tells the story — the bounded server stays flat
// at its limit while the unbounded one's backlog explodes, and once the wait passes the client's
// deadline every request it serves is already wasted. Drag the offered load past the service rate and
// watch the unbounded server collapse while the shedding one holds steady goodput. Real sim from loadshed.ts.
import { useMemo, useState } from 'react';
import { simulate } from './loadshed';

const RATE = 2, DEADLINE = 3, CAP = 4;

export function LoadShedSection() {
  const [overload, setOverload] = useState(5);
  const load = useMemo(() => [1, 1, 2, 2, ...Array(12).fill(overload)], [overload]);

  const shed = useMemo(() => simulate(load, CAP, RATE, DEADLINE, 'shed'), [load]);
  const unb = useMemo(() => simulate(load, CAP, RATE, DEADLINE, 'unbounded'), [load]);
  const maxQ = Math.max(1, unb.maxQueue);
  const W = 560, H = 130;
  const X = (i: number) => (i / (load.length - 1)) * W;
  const Y = (q: number) => H - (q / maxQ) * (H - 10);
  const line = (r: typeof shed) => r.ticks.map((t, i) => `${X(i).toFixed(1)},${Y(t.queueLen).toFixed(1)}`).join(' ');

  return (
    <div className="lsh">
      <div className="lsh-controls">
        <label>offered load (req/tick) <input type="range" min={1} max={8} value={overload} onChange={(e) => setOverload(+e.target.value)} /><b>{overload}</b></label>
        <span className="lsh-fixed">service rate {RATE}/tick · queue cap {CAP} · client deadline {DEADLINE}</span>
      </div>

      <div className="lsh-chart">
        <div className="lsh-chart-h">queue length over time {overload > RATE ? '(offered load exceeds service rate → overload)' : '(under capacity)'}</div>
        <svg viewBox={`0 0 ${W} ${H + 14}`} className="lsh-svg">
          <line x1={0} y1={Y(CAP)} x2={W} y2={Y(CAP)} className="lsh-cap" />
          <text x={2} y={Y(CAP) - 3} className="lsh-caplbl">queue cap {CAP}</text>
          <polyline points={line(unb)} className="lsh-line unb" />
          <polyline points={line(shed)} className="lsh-line shed" />
        </svg>
        <div className="lsh-legend"><span className="lsh-lg shed" /> bounded + shed <span className="lsh-lg unb" /> unbounded queue</div>
      </div>

      <div className="lsh-cards">
        {([['bounded + shed', shed, true], ['unbounded queue', unb, false]] as const).map(([title, r, good]) => (
          <div key={title} className={`lsh-card ${good ? 'ok' : 'bad'}`}>
            <div className="lsh-card-h">{title}</div>
            <div className="lsh-metrics">
              <div><span>goodput</span><b className="g">{r.goodput}</b></div>
              <div><span>wasted (served too late)</span><b className={r.wasted > 0 ? 'w' : ''}>{r.wasted}</b></div>
              <div><span>shed (fast 503)</span><b>{r.shed}</b></div>
              <div><span>final backlog</span><b className={r.finalQueue > CAP ? 'w' : ''}>{r.finalQueue}</b></div>
            </div>
          </div>
        ))}
      </div>

      <p className="lsh-foot">
        Counter-intuitively, accepting <em>less</em> work yields <em>more</em> useful work. The unbounded server isn’t “trying harder” — its backlog
        means every request waits longer than the client will, so it spends 100% of its capacity producing responses that are already discarded
        (<strong>congestion collapse</strong>; raising offered load drives goodput toward zero). Shedding keeps the queue — and therefore the wait —
        bounded, so accepted requests beat the deadline, and the fast rejection is <strong>backpressure</strong> that tells callers to slow down or
        try another replica. Real systems shed by priority (drop cheap/optional traffic first), pair it with <em>deadline propagation</em> (don’t
        start work whose deadline already passed) and client-side <em>retry budgets</em> so retries don’t become the overload. (Google SRE, Handling Overload.)
      </p>
    </div>
  );
}
