// Token-bucket rate limiting, made visible. A bucket refills R tokens per tick (up
// to capacity C); each request spends a token or gets a 429. So you can burst up to
// C instantly, but the sustained rate is capped at R. Drag the sliders and watch a
// burst drain the bucket, then steady-state throttling kick in. Real model (tokenbucket.ts).
import { useEffect, useMemo, useState } from 'react';
import { simulateBucket, bucketStats } from './tokenbucket';

const TICKS = 24;
const CW = 600, CH = 150, CL = 30, CB = 18, CT = 8;
const PW = CW - CL - 8, PH = CH - CT - CB;

export function TokenBucketSection() {
  const [capacity, setCapacity] = useState(6);
  const [refill, setRefill] = useState(2);
  const [arrivals, setArrivals] = useState(4);
  const [step, setStep] = useState(TICKS);
  const [playing, setPlaying] = useState(false);

  const trace = useMemo(() => simulateBucket({ capacity, refill, ticks: TICKS, arrivals, initialTokens: capacity }), [capacity, refill, arrivals]);
  const stats = useMemo(() => bucketStats(trace), [trace]);
  const maxBar = Math.max(1, ...trace.map((t) => t.arrived));

  useEffect(() => { setStep(TICKS); }, [capacity, refill, arrivals]);
  useEffect(() => {
    if (!playing) return;
    if (step >= TICKS) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, TICKS)), 320);
    return () => clearTimeout(id);
  }, [playing, step]);

  const cur = trace[Math.min(step, TICKS) - 1] ?? trace[0];
  const tokens = step === 0 ? capacity : cur.tokensEnd;
  const shown = trace.slice(0, Math.max(1, step));
  const x = (t: number) => CL + (t / (TICKS - 1)) * PW;
  const y = (v: number) => CT + PH - (v / maxBar) * PH;
  const bw = Math.max(3, PW / TICKS - 2);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Token-bucket rate limiting — bursts allowed, average capped</h2></div>
        <p className="jsec-sub">
          A rate limiter doesn’t just cap requests per second — it lets you <em>burst</em>. A bucket holds up to
          <strong> {capacity} tokens</strong> and refills <strong>{refill}/tick</strong>; each request spends one, or gets a
          429. So a full bucket absorbs a sudden spike, but once it’s empty you’re throttled to the refill rate. Push the
          arrival rate past the refill rate and watch the rejects begin.
        </p>

        <div className="tb-controls">
          <label>capacity (burst): {capacity}<input type="range" min={1} max={12} value={capacity} onChange={(e) => setCapacity(+e.target.value)} /></label>
          <label>refill/tick (rate): {refill}<input type="range" min={0} max={6} value={refill} onChange={(e) => setRefill(+e.target.value)} /></label>
          <label>arrivals/tick: {arrivals}<input type="range" min={0} max={10} value={arrivals} onChange={(e) => setArrivals(+e.target.value)} /></label>
          <div className="tb-play">
            <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮</button>
            <button className="ghost small" onClick={() => { if (step >= TICKS) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶'}</button>
            <button className="ghost small" onClick={() => { setStep(TICKS); setPlaying(false); }}>all</button>
          </div>
        </div>

        <div className="tb-stage">
          <div className="tb-bucket-area">
            <div className="tb-refill">refill ↓ {refill}/tick</div>
            <div className="tb-bucket">
              {Array.from({ length: capacity }, (_, i) => {
                const filled = capacity - 1 - i < tokens; // fill from the bottom
                return <span key={i} className={`tb-token ${filled ? 'on' : ''}`} />;
              })}
            </div>
            <div className="tb-count">{tokens}/{capacity} tokens</div>
          </div>
          <div className="tb-now">
            <div className="tb-now-line">tick {Math.min(step, TICKS)}: <strong>{cur.arrived}</strong> arrived</div>
            <div className="tb-now-line ok">✓ {cur.allowed} allowed</div>
            <div className="tb-now-line bad">✕ {cur.rejected} rejected (429)</div>
          </div>
        </div>

        <svg className="tb-svg" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="allowed vs rejected per tick">
          {shown.map((t) => (
            <g key={t.t}>
              <rect x={x(t.t) - bw / 2} y={y(t.allowed)} width={bw} height={CT + PH - y(t.allowed)} className="tb-bar-ok" />
              <rect x={x(t.t) - bw / 2} y={y(t.allowed + t.rejected)} width={bw} height={y(t.allowed) - y(t.allowed + t.rejected)} className="tb-bar-bad" />
            </g>
          ))}
          <line x1={CL} y1={y(refill)} x2={CW - 8} y2={y(refill)} className="tb-rate-line" />
          <text x={CW - 10} y={y(refill) - 3} className="cc-axis" textAnchor="end">refill rate {refill}</text>
        </svg>
        <div className="tb-legend">
          <span><i className="cc-sw" style={{ background: 'hsl(145 55% 50%)' }} /> allowed</span>
          <span><i className="cc-sw" style={{ background: 'hsl(0 70% 58%)' }} /> rejected (429)</span>
          <span className="tb-accept">accept rate: {Math.round(stats.acceptRate * 100)}% ({stats.totalAllowed}/{stats.totalArrived})</span>
        </div>
        <p className="enc-note">This is why a well-designed API returns <code>429 Too Many Requests</code> with a <code>Retry-After</code> rather than
          just dropping you: the bucket is empty now, but it refills predictably. The same algorithm shapes traffic on a link (committed rate + burst)
          — only there a “token” is bytes, not requests.</p>
      </section>
    </div>
  );
}
