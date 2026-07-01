// GCRA, made visible. A client fires requests at a chosen cadence against a limit of one-per-T with burst
// tolerance τ. Watch the single TAT ("theoretical arrival time") line march ahead of the clock as requests are
// accepted; when a request arrives before TAT−τ it's throttled (red) and the TAT holds. The whole limiter state
// is that one rising line. Real model from gcra.ts.
import { useMemo, useState } from 'react';
import { simulate, burstCapacity } from './gcra';

const N = 26;

export function GcraSection() {
  const [T, setT] = useState(100);          // emission interval (ms) → 1 req / 100ms = 10/s
  const [tau, setTau] = useState(300);      // burst tolerance (ms)
  const [interval, setInterval] = useState(40); // client sends every 40ms (faster than the limit)

  const { decisions, allowed } = useMemo(() => {
    const times = Array.from({ length: N }, (_, i) => i * interval);
    const decisions = simulate(times, T, tau);
    return { decisions, allowed: decisions.filter((d) => d.allow).length };
  }, [T, tau, interval]);

  const cap = burstCapacity(T, tau);
  const maxT = (N - 1) * interval;
  const maxTat = Math.max(...decisions.map((d) => d.tat), maxT);
  const W = 640, H = 210, PL = 20, PB = 30, PT = 14, PR = 14;
  const px = (t: number) => PL + (t / maxTat) * (W - PL - PR);
  const py = (t: number) => H - PB - (t / maxTat) * (H - PB - PT);
  const tatLine = decisions.map((d) => `${px(d.t).toFixed(1)},${py(d.tat).toFixed(1)}`).join(' ');

  return (
    <div className="gcra">
      <p className="gcra-intro">
        GCRA rate-limits with a <strong>single timestamp</strong>: the TAT, the earliest time a perfectly-paced
        client <em>should</em> send next. A request at time <code>t</code> is allowed iff <code>t ≥ TAT − τ</code>;
        if so, <code>TAT ← max(t, TAT) + T</code>. Idle time banks burst up to τ; sending too fast pushes the TAT
        past your clock until you're throttled. No token counter, no timer — just one number.
      </p>

      <div className="gcra-controls">
        <label>1 request / <b>{T}</b> ms<input type="range" min={40} max={300} step={10} value={T} onChange={(e) => setT(+e.target.value)} /></label>
        <label>burst tolerance τ = <b>{tau}</b> ms<input type="range" min={0} max={800} step={20} value={tau} onChange={(e) => setTau(+e.target.value)} /></label>
        <label>client sends every <b>{interval}</b> ms<input type="range" min={20} max={300} step={10} value={interval} onChange={(e) => setInterval(+e.target.value)} /></label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="gcra-chart">
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} className="gcra-axis" />
        <polyline points={tatLine} className="gcra-tat" />
        {decisions.map((d, i) => (
          <g key={i}>
            <line x1={px(d.t)} y1={H - PB} x2={px(d.t)} y2={H - PB + 5} className="gcra-tick" />
            <circle cx={px(d.t)} cy={H - PB - 3} r={4} className={`gcra-req ${d.allow ? 'ok' : 'no'}`} />
          </g>
        ))}
        <text x={px(maxTat * 0.5)} y={py(maxTat * 0.5) - 4} className="gcra-tatlbl">TAT (the only state)</text>
        <text x={W - PR} y={H - 4} className="gcra-axl" textAnchor="end">request arrival time →</text>
      </svg>
      <div className="gcra-legend"><span className="gcra-lg ok">accepted</span><span className="gcra-lg no">throttled (t &lt; TAT−τ)</span><span className="gcra-lg tat">TAT</span></div>

      <div className="gcra-stats">
        <div className="gcra-stat"><span>burst capacity ⌊τ/T⌋+1</span><b>{cap}</b></div>
        <div className="gcra-stat ok"><span>accepted</span><b>{allowed}/{N}</b></div>
        <div className="gcra-stat"><span>sustained rate</span><b>{(1000 / T).toFixed(1)}/s</b></div>
        <div className="gcra-stat"><span>client rate</span><b>{(1000 / interval).toFixed(1)}/s</b></div>
      </div>

      <p className="gcra-foot">
        Watch the line: while the client sends slower than the limit the TAT tracks just behind the clock and
        everything passes; speed up and the TAT climbs above the diagonal, and once it gets more than τ ahead the
        requests underneath it turn red. The gap <code>TAT − τ − t</code> at a rejection is exactly the
        <strong> Retry-After</strong> you hand back — the client can compute precisely when it will be welcome
        again, which beats a bare 429. GCRA is a form of <em>virtual scheduling</em>: rather than metering what
        has happened, it plans when the next event is allowed to happen, so bursts are shaped smoothly instead of
        being allowed all at once and then hard-stopped. Because the state is one timestamp with no background
        refill, it's ideal for distributed limiting — Redis stores it as a single key and updates it atomically
        with a Lua script or the redis-cell module, so a fleet of API servers shares one consistent limit per
        client with a single round-trip. The tradeoffs mirror the token bucket it's equivalent to: choosing τ
        trades burst-friendliness against how much a client can hammer a cold endpoint, and like all
        single-window limiters it doesn't distinguish a client that's genuinely bursty from one that's abusive —
        for that you layer it (per-IP, per-key, per-route) or pair it with concurrency limits. It's the same
        shaping idea as leaky-bucket traffic policing, reduced to its arithmetic core. (ITU-T I.371; redis-cell.)
      </p>
    </div>
  );
}
