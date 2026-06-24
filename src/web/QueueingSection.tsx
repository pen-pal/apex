// M/M/1 queueing — the 1/(1−ρ) curve made visible. Slide the arrival rate toward the
// link's service rate and watch the mean delay shoot up: gentle until ~70% load, then
// a knee, then a wall. This is the math under bufferbloat and QoS — a fuller link is
// a slower link, and a bigger buffer just hides the loss as latency. Model in queue.ts
// (verified to the closed forms).
import { useState } from 'react';
import { mm1, latencyFactor } from './queue';

const CAP = 20; // y-axis tops out at 20× one service time

export function QueueingSection() {
  const [mu, setMu] = useState(1000);
  const [lambda, setLambda] = useState(700);
  const lam = Math.min(lambda, mu - 1);
  const q = mm1(lam, mu);
  const ms = (s: number) => (isFinite(s) ? `${(s * 1000).toFixed(s * 1000 >= 100 ? 0 : 1)} ms` : '∞');

  // build the curve path: latency factor vs utilisation, ρ in [0, 0.97]
  const W = 520, H = 200, pad = 34;
  const px = (rho: number) => pad + rho * (W - pad - 6);
  const py = (f: number) => H - pad - (Math.min(f, CAP) / CAP) * (H - pad - 6);
  const pts = Array.from({ length: 98 }, (_, i) => i / 100).map((rho) => `${px(rho)},${py(latencyFactor(rho))}`);
  const tier = q.rho < 0.7 ? 'ok' : q.rho < 0.9 ? 'mid' : 'bad';

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>M/M/1 — why a full link is a slow link</h2></div>
        <p className="jsec-sub">
          Packets arrive at rate <strong>λ</strong> and the link serves them at rate <strong>μ</strong>; the utilisation is{' '}
          <strong>ρ = λ/μ</strong>. The mean time through the system is <code>W = 1/(μ−λ)</code> — at 50% load that's two service
          times, at 90% it's ten, at 99% a hundred. There's no buffer size that fixes it: more buffer just turns drops into delay.
        </p>

        <div className="qu-controls">
          <label>service rate μ = {mu}/s<input type="range" min={200} max={2000} step={50} value={mu} onChange={(e) => setMu(Number(e.target.value))} /></label>
          <label>arrival rate λ = {lam}/s<input type="range" min={0} max={mu - 1} step={10} value={lam} onChange={(e) => setLambda(Number(e.target.value))} /></label>
        </div>

        <div className="qu-stage">
          <svg className="qu-plot" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
            {[0.7, 0.9].map((r) => <line key={r} x1={px(r)} y1={pad - 6} x2={px(r)} y2={H - pad} className="qu-guide" />)}
            {[1, 5, 10, 15, 20].map((f) => <text key={f} x={4} y={py(f) + 3} className="qu-axis">{f}×</text>)}
            <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} className="qu-axisline" />
            <polyline points={pts.join(' ')} className="qu-curve" />
            {q.stable && <circle cx={px(q.rho)} cy={py(latencyFactor(q.rho))} r={5} className={`qu-dot ${tier}`} />}
            <text x={px(0.7)} y={H - pad + 14} className="qu-axis">70%</text>
            <text x={px(0.9)} y={H - pad + 14} className="qu-axis">90%</text>
            <text x={W - 30} y={H - pad + 14} className="qu-axis">ρ →</text>
          </svg>
          <div className="qu-metrics">
            <div className={`qu-rho ${tier}`}>ρ = {(q.rho * 100).toFixed(0)}%</div>
            <div className="qu-m"><span>W (in system)</span><strong>{ms(q.W)}</strong></div>
            <div className="qu-m"><span>Wq (in queue)</span><strong>{ms(q.Wq)}</strong></div>
            <div className="qu-m"><span>L (in system)</span><strong>{isFinite(q.L) ? q.L.toFixed(1) : '∞'} pkt</strong></div>
            <div className="qu-m"><span>Lq (waiting)</span><strong>{isFinite(q.Lq) ? q.Lq.toFixed(1) : '∞'} pkt</strong></div>
            <div className="qu-m"><span>vs idle link</span><strong>{q.stable ? `${latencyFactor(q.rho).toFixed(1)}×` : '∞'}</strong></div>
          </div>
        </div>

        <p className="qu-note">
          {tier === 'ok' && 'Comfortable — delay is within a few service times. This is the operating range you design for.'}
          {tier === 'mid' && 'Into the knee — every extra bit of load now costs disproportionate delay. Above here latency is fragile to bursts.'}
          {tier === 'bad' && 'Past the wall — the link is nearly saturated and the queue (and delay) runs away. A burst here means seconds of latency or loss.'}
          {' '}This is exactly why links are provisioned to ~70%, why AQM (see Bufferbloat) drops early instead of buffering, and why QoS exists — to choose <em>whose</em> packets wait when ρ climbs.
        </p>
      </section>
    </div>
  );
}
