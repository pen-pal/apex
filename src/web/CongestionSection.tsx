// TCP congestion control, made visible — the cwnd sawtooth that governs how fast
// every TCP connection may send. Watch slow start ramp exponentially, congestion
// avoidance climb linearly, and injected losses cut the window (fast recovery vs a
// full timeout collapse). The model is real TCP Reno (see tcpcc.ts).
import { useEffect, useMemo, useState } from 'react';
import { simulateReno, peakCwnd, type LossKind } from './tcpcc';

const ROUNDS = 24;
const W = 660, H = 320, L = 38, R = 14, T = 16, B = 30;
const PLOT_W = W - L - R, PLOT_H = H - T - B;
const NEXT_LOSS: Record<LossKind, LossKind> = { none: 'triple-dup-ack', 'triple-dup-ack': 'timeout', timeout: 'none' };

export function CongestionSection() {
  const [ssthresh, setSsthresh] = useState(16);
  const [losses, setLosses] = useState<Record<number, LossKind>>({ 9: 'triple-dup-ack', 17: 'timeout' });
  const [step, setStep] = useState(ROUNDS);
  const [playing, setPlaying] = useState(false);

  const trace = useMemo(() => simulateReno({ rounds: ROUNDS, initialSsthresh: ssthresh, initialCwnd: 1, losses }), [ssthresh, losses]);
  const peak = useMemo(() => Math.max(4, peakCwnd(trace)), [trace]);

  useEffect(() => {
    if (!playing) return;
    if (step >= ROUNDS) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, ROUNDS)), 280);
    return () => clearTimeout(id);
  }, [playing, step]);

  const x = (r: number) => L + (r / (ROUNDS - 1)) * PLOT_W;
  const y = (v: number) => T + PLOT_H - (v / peak) * PLOT_H;
  const shown = trace.slice(0, Math.max(1, step));

  const cycleLoss = (r: number) => {
    setLosses((ls) => { const cur = ls[r] ?? 'none'; const nx = NEXT_LOSS[cur]; const out = { ...ls }; if (nx === 'none') delete out[r]; else out[r] = nx; return out; });
    setStep(ROUNDS);
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>TCP congestion control — the cwnd sawtooth</h2></div>
        <p className="jsec-sub">
          TCP can’t see the network’s capacity, so it probes for it. <strong>Slow start</strong> doubles the congestion
          window each round trip until it hits a threshold; <strong>congestion avoidance</strong> then adds one segment
          per RTT. A loss means it overshot — so it backs off. <strong>Click any round</strong> to inject a loss (once
          = fast retransmit, twice = timeout) and watch the window react. This is TCP Reno (RFC 5681).
        </p>

        <div className="cc-controls">
          <label>initial ssthresh: {ssthresh}
            <input type="range" min={4} max={32} value={ssthresh} onChange={(e) => { setSsthresh(+e.target.value); setStep(ROUNDS); }} />
          </label>
          <div className="cc-play">
            <button className="ghost small" onClick={() => { setStep(1); setPlaying(false); }}>⏮</button>
            <button className="ghost small" onClick={() => { if (step >= ROUNDS) setStep(1); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶ animate'}</button>
            <button className="ghost small" onClick={() => { setStep(ROUNDS); setPlaying(false); }}>show all</button>
            <button className="ghost small" onClick={() => { setLosses({}); setStep(ROUNDS); }}>clear losses</button>
          </div>
        </div>

        <svg className="cc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="cwnd over time">
          {/* y grid + labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = Math.round(peak * f);
            return <g key={f}><line x1={L} y1={y(v)} x2={W - R} y2={y(v)} className="cc-grid" /><text x={L - 6} y={y(v) + 3} className="cc-axis">{v}</text></g>;
          })}
          <text x={L - 30} y={T + PLOT_H / 2} className="cc-axis-title" transform={`rotate(-90 ${L - 30} ${T + PLOT_H / 2})`}>cwnd (MSS)</text>
          <text x={L + PLOT_W / 2} y={H - 4} className="cc-axis" textAnchor="middle">RTT round →</text>

          {/* clickable columns to inject loss */}
          {trace.map((r) => (
            <rect key={`c${r.rtt}`} x={x(r.rtt) - PLOT_W / (ROUNDS - 1) / 2} y={T} width={PLOT_W / (ROUNDS - 1)} height={PLOT_H} className="cc-col" onClick={() => cycleLoss(r.rtt)}>
              <title>round {r.rtt} — click to inject a loss</title>
            </rect>
          ))}

          {/* ssthresh stepped dashed line */}
          <path className="cc-ssthresh" d={shown.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(r.rtt)},${y(r.ssthresh)}`).join(' ')} />

          {/* cwnd line, segment-colored by phase */}
          {shown.slice(1).map((r, i) => {
            const prev = shown[i];
            return <line key={`s${r.rtt}`} x1={x(prev.rtt)} y1={y(prev.cwnd)} x2={x(r.rtt)} y2={y(r.cwnd)} className={`cc-line ${prev.phase === 'slow-start' ? 'ss' : 'ca'}`} />;
          })}

          {/* points + loss markers */}
          {shown.map((r) => (
            <g key={`p${r.rtt}`}>
              <circle cx={x(r.rtt)} cy={y(r.cwnd)} r={3} className={`cc-dot ${r.phase === 'slow-start' ? 'ss' : 'ca'}`} />
              {r.event !== 'none' && (
                <g>
                  <line x1={x(r.rtt)} y1={T} x2={x(r.rtt)} y2={T + PLOT_H} className={`cc-loss ${r.event}`} />
                  <text x={x(r.rtt)} y={T - 4} className="cc-loss-lbl" textAnchor="middle">{r.event === 'timeout' ? '⏱ timeout' : '✕✕✕'}</text>
                </g>
              )}
            </g>
          ))}
        </svg>

        <div className="cc-legend">
          <span><i className="cc-sw ss" /> slow start (×2 / RTT)</span>
          <span><i className="cc-sw ca" /> congestion avoidance (+1 / RTT)</span>
          <span><i className="cc-sw th" /> ssthresh</span>
          <span><i className="cc-sw loss" /> loss event</span>
        </div>
        <p className="enc-note">A <strong>triple-duplicate-ACK</strong> means three later segments arrived but one is missing — a mild signal, so
          Reno halves the window and keeps going (fast recovery). A <strong>timeout</strong> means silence — a severe signal, so it collapses to
          one segment and restarts slow start. That asymmetry is the whole sawtooth: gentle dips for mild loss, cliffs for timeouts.</p>
      </section>
    </div>
  );
}
