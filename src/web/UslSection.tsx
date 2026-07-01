// Universal Scalability Law, made visible. Drag the two knobs — contention α (serialization) and coherency β
// (pairwise coordination) — and watch the throughput-vs-concurrency curve change shape: perfect linear when
// both are zero, an Amdahl ceiling when only α is set, and a peak-then-decline (retrograde) curve when β turns
// on. The dashed line is ideal linear scaling; the marker is the optimal concurrency N*. Real model from usl.ts.
import { useMemo, useState } from 'react';
import { throughput, peakConcurrency, amdahlCeiling, curve } from './usl';

const MAXN = 256;
const PRESETS: Record<string, [number, number]> = {
  'ideal linear': [0, 0],
  'Amdahl only': [0.05, 0],
  'typical service': [0.03, 0.0002],
  'coordination-heavy': [0.06, 0.0015],
};

export function UslSection() {
  const [alpha, setAlpha] = useState(0.03);
  const [beta, setBeta] = useState(0.0002);

  const data = useMemo(() => curve(alpha, beta, MAXN), [alpha, beta]);
  const star = peakConcurrency(alpha, beta);
  const ceiling = amdahlCeiling(alpha);
  const peakC = star !== Infinity && star >= 1 ? throughput(Math.round(star), alpha, beta) : data[data.length - 1].c;
  const yMax = Math.max(1.1, ...data.map((d) => d.c)) * 1.12;

  // chart geometry
  const W = 560, H = 260, PL = 40, PB = 28, PT = 12, PR = 12;
  const px = (n: number) => PL + ((n - 1) / (MAXN - 1)) * (W - PL - PR);
  const py = (c: number) => H - PB - (c / yMax) * (H - PB - PT);
  const line = data.map((d) => `${px(d.n).toFixed(1)},${py(d.c).toFixed(1)}`).join(' ');
  const linearCapN = Math.min(MAXN, yMax); // where the ideal-linear line leaves the top
  const showCeiling = ceiling !== Infinity && ceiling <= yMax;
  const showStar = star !== Infinity && star >= 1 && star <= MAXN;

  return (
    <div className="usl">
      <p className="usl-intro">
        More workers should mean more throughput — but two costs get in the way. <strong>Contention</strong> (α):
        parts of the work serialize (a lock, a shared step), capping speedup à la Amdahl. <strong>Coherency</strong>
        (β): workers must coordinate, and that crosstalk grows with the number of <em>pairs</em> (∝ N²), so past
        a point it overwhelms the gains and throughput goes <strong>backwards</strong>. Drag the knobs:
      </p>

      <div className="usl-presets">
        {Object.entries(PRESETS).map(([name, [a, b]]) => (
          <button key={name} type="button" className={`usl-preset ${alpha === a && beta === b ? 'on' : ''}`} onClick={() => { setAlpha(a); setBeta(b); }}>{name}</button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="usl-chart">
        {/* axes */}
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} className="usl-axis" />
        <line x1={PL} y1={PT} x2={PL} y2={H - PB} className="usl-axis" />
        {/* ideal linear reference */}
        <line x1={px(1)} y1={py(1)} x2={px(linearCapN)} y2={py(linearCapN)} className="usl-linear" />
        {/* Amdahl ceiling */}
        {showCeiling && <line x1={PL} y1={py(ceiling)} x2={W - PR} y2={py(ceiling)} className="usl-ceiling" />}
        {showCeiling && <text x={W - PR} y={py(ceiling) - 4} className="usl-clabel" textAnchor="end">Amdahl ceiling 1/α = {ceiling.toFixed(0)}</text>}
        {/* the USL curve */}
        <polyline points={line} className="usl-curve" />
        {/* peak marker */}
        {showStar && <>
          <line x1={px(star)} y1={py(peakC)} x2={px(star)} y2={H - PB} className="usl-starline" />
          <circle cx={px(star)} cy={py(peakC)} r={4.5} className="usl-star" />
          <text x={px(star)} y={py(peakC) - 8} className="usl-starlabel" textAnchor="middle">peak N*≈{Math.round(star)}</text>
        </>}
        <text x={PL - 6} y={py(yMax * 0.92)} className="usl-axlabel" textAnchor="end">C(N)</text>
        <text x={W - PR} y={H - 8} className="usl-axlabel" textAnchor="end">concurrency N →</text>
      </svg>

      <div className="usl-knobs">
        <label className="usl-knob">
          <span>contention α <b>{alpha.toFixed(3)}</b></span>
          <input type="range" min={0} max={0.2} step={0.005} value={alpha} onChange={(e) => setAlpha(+e.target.value)} />
        </label>
        <label className="usl-knob">
          <span>coherency β <b>{beta.toFixed(4)}</b></span>
          <input type="range" min={0} max={0.004} step={0.0001} value={beta} onChange={(e) => setBeta(+e.target.value)} />
        </label>
      </div>

      <div className="usl-stats">
        <div className={`usl-stat ${showStar ? 'warn' : 'ok'}`}><span>optimal concurrency N*</span><b>{showStar ? Math.round(star) : '∞'}</b></div>
        <div className="usl-stat"><span>peak throughput</span><b>{peakC.toFixed(1)}×</b></div>
        <div className="usl-stat"><span>Amdahl ceiling 1/α</span><b>{ceiling === Infinity ? '∞' : ceiling.toFixed(0)}</b></div>
        <div className="usl-stat"><span>throughput at N=256</span><b>{throughput(256, alpha, beta).toFixed(1)}×</b></div>
      </div>

      <p className="usl-foot">
        The practical lesson is that <strong>capacity has a sweet spot</strong>. With β&gt;0, there is an optimal
        concurrency N* = √((1−α)/β), and pushing past it — more threads, more connections, more nodes — buys you
        <em> less</em> total throughput, not more. That is exactly why a database has an ideal connection-pool
        size (and why a pooler like PgBouncer helps), why a thread pool sized to the core count often beats one
        sized to the request count, and why adding servers to a chatty, all-to-all cluster can slow it down. The
        fix is to attack the coefficients, not add hardware: cut <strong>α</strong> by shrinking critical
        sections and sharding hot locks; cut <strong>β</strong> — the expensive one — by reducing coordination
        (partition so workers don't talk, batch, use eventual consistency, avoid all-to-all chatter). Fit α and
        β to three or four load-test points and the USL will <em>predict</em> your peak, so you can find it on a
        spreadsheet instead of discovering it in an outage. Amdahl's law is just the USL with β=0: it warns you
        about the ceiling; the USL warns you that you can fall off the far side of it. (Gunther, Guerrilla
        Capacity Planning.)
      </p>
    </div>
  );
}
