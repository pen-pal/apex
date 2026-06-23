// Bufferbloat, made visible — why a fat buffer wrecks latency. A bottleneck drains
// a fixed rate; when traffic exceeds it, packets queue. A BIG buffer absorbs the
// overload but every packet then waits behind a long line (latency balloons). AQM
// drops early to keep the standing queue — and thus delay — small. Both curves are
// plotted so the contrast is the headline. Real queue math (see bufferbloat.ts).
import { useEffect, useMemo, useState } from 'react';
import { simulateQueue, delayStats, totalDropped, type Mode } from './bufferbloat';

const TICKS = 24, DRAIN = 2;
const W = 660, H = 240, L = 40, Rr = 14, T = 14, Bm = 28;
const PW = W - L - Rr, PH = H - T - Bm;

export function BufferbloatSection() {
  const [arrivals, setArrivals] = useState(4);
  const [bufferSize, setBufferSize] = useState(28);
  const [mode, setMode] = useState<Mode>('big-buffer');
  const [step, setStep] = useState(TICKS);
  const [playing, setPlaying] = useState(false);

  const cfg = { ticks: TICKS, drain: DRAIN, bufferSize, arrivals };
  const bigT = useMemo(() => simulateQueue({ ...cfg, mode: 'big-buffer' }), [arrivals, bufferSize]);
  const aqmT = useMemo(() => simulateQueue({ ...cfg, mode: 'aqm', aqmTargetDelay: 1 }), [arrivals, bufferSize]);
  const sel = mode === 'big-buffer' ? bigT : aqmT;
  const peakDelay = Math.max(1, delayStats(bigT).peak, delayStats(aqmT).peak);

  useEffect(() => { setStep(TICKS); }, [arrivals, bufferSize, mode]);
  useEffect(() => {
    if (!playing) return;
    if (step >= TICKS) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, TICKS)), 260);
    return () => clearTimeout(id);
  }, [playing, step]);

  const x = (t: number) => L + (t / (TICKS - 1)) * PW;
  const y = (d: number) => T + PH - (d / peakDelay) * PH;
  const line = (tr: typeof bigT) => tr.slice(0, Math.max(1, step)).map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t)},${y(p.delay)}`).join(' ');
  const cur = sel[Math.min(step, TICKS) - 1] ?? sel[0];
  const targetQ = DRAIN; // AQM standing target (target delay 1 × drain)

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Bufferbloat — why a bigger buffer makes things slower</h2></div>
        <p className="jsec-sub">
          A buffer is supposed to smooth bursts, but make it too big and it just stores a huge backlog: every packet
          waits behind the whole queue, so latency balloons even though throughput is fine. That’s <strong>bufferbloat</strong>
          — your video call stutters the moment someone starts an upload. <strong>AQM</strong> (CoDel) drops early to keep the
          queue short. Raise the arrival rate and compare.
        </p>

        <div className="bb-controls">
          <div className="seg">
            <button className={mode === 'big-buffer' ? 'on' : ''} onClick={() => setMode('big-buffer')}>Big buffer</button>
            <button className={mode === 'aqm' ? 'on' : ''} onClick={() => setMode('aqm')}>AQM (CoDel)</button>
          </div>
          <label>arrival rate: {arrivals}/tick<input type="range" min={1} max={6} value={arrivals} onChange={(e) => setArrivals(+e.target.value)} /></label>
          <label>buffer size: {bufferSize}<input type="range" min={4} max={40} value={bufferSize} onChange={(e) => setBufferSize(+e.target.value)} /></label>
          <div className="bb-play">
            <button className="ghost small" onClick={() => { setStep(1); setPlaying(false); }}>⏮</button>
            <button className="ghost small" onClick={() => { if (step >= TICKS) setStep(1); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶'}</button>
            <button className="ghost small" onClick={() => { setStep(TICKS); setPlaying(false); }}>all</button>
          </div>
        </div>

        {/* the queue/buffer for the selected mode at the current tick */}
        <div className="bb-queue-wrap">
          <span className="bb-tag">arrivals {arrivals}/tick →</span>
          <div className="bb-buffer">
            {Array.from({ length: bufferSize }, (_, i) => {
              const filled = i < cur.queueAfter;
              const overTarget = i >= targetQ;
              return <span key={i} className={`bb-cell ${filled ? (overTarget ? 'over' : 'ok') : ''}`} />;
            })}
            <span className="bb-target" style={{ left: `${(targetQ / bufferSize) * 100}%` }} title="AQM target">AQM target</span>
          </div>
          <span className="bb-tag">→ drain {DRAIN}/tick</span>
        </div>
        <div className="bb-now">queue: <strong>{cur.queueAfter}</strong> pkts · queuing delay: <strong>{cur.delay.toFixed(1)}</strong> ticks{cur.dropped > 0 && <span className="bb-drop"> · dropped {cur.dropped} this tick</span>}</div>

        {/* latency over time: both curves */}
        <svg className="bb-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="queuing delay over time">
          {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} y1={y(peakDelay * f)} x2={W - Rr} y2={y(peakDelay * f)} className="cc-grid" /><text x={L - 6} y={y(peakDelay * f) + 3} className="cc-axis">{(peakDelay * f).toFixed(0)}</text></g>)}
          <text x={L - 30} y={T + PH / 2} className="cc-axis-title" transform={`rotate(-90 ${L - 30} ${T + PH / 2})`}>delay (ticks)</text>
          <path d={line(bigT)} className="bb-curve big" />
          <path d={line(aqmT)} className="bb-curve aqm" />
        </svg>
        <div className="bb-legend">
          <span><i className="cc-sw" style={{ background: 'hsl(0 70% 55%)' }} /> big buffer — peak delay {delayStats(bigT).peak.toFixed(1)}, drops {totalDropped(bigT)}</span>
          <span><i className="cc-sw" style={{ background: 'hsl(145 55% 42%)' }} /> AQM — peak delay {delayStats(aqmT).peak.toFixed(1)}, drops {totalDropped(aqmT)}</span>
        </div>
        <p className="enc-note">The fix isn’t a bigger buffer — it’s a <em>smarter</em> one. AQM accepts a few more drops (which TCP reads as
          “slow down”) to keep the standing queue tiny, so interactive traffic stays responsive even while a bulk transfer runs. This is why
          modern routers ship fq_codel by default.</p>
      </section>
    </div>
  );
}
