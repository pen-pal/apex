// TCP CUBIC, made visible. Plot the congestion window over many round-trips, with losses
// you can place; the window follows the cubic curve — fast toward W_max, flat around it,
// fast above it — overlaid against Reno's linear +1/RTT climb so the difference is plain.
// Real CUBIC math in cubic.ts (tested against the RFC 8312 formula).
import { useMemo, useState } from 'react';
import { simulateCubic } from './cubic';

const ROUNDS = 40;
const LOSSES = [8, 22, 33];

// a simple Reno trace for comparison: slow start ×2 to first loss, then +1/round, halving on loss
function reno(rounds: number, losses: number[]): number[] {
  const out: number[] = []; let cwnd = 1, ss = true, ssthresh = 64;
  for (let r = 0; r < rounds; r++) {
    if (losses.includes(r)) { ssthresh = Math.max(2, cwnd / 2); cwnd = ssthresh; ss = false; }
    else if (ss && cwnd < ssthresh) cwnd *= 2;
    else { ss = false; cwnd += 1; }
    out.push(cwnd);
  }
  return out;
}

export function CubicSection() {
  const [losses, setLosses] = useState<number[]>(LOSSES);
  const cubic = useMemo(() => simulateCubic(ROUNDS, losses), [losses]);
  const renoT = useMemo(() => reno(ROUNDS, losses), [losses]);

  const maxY = Math.max(...cubic.map((r) => r.cwnd), ...renoT) * 1.1;
  const W = 100, H = 52;
  const x = (r: number) => (r / (ROUNDS - 1)) * W;
  const y = (c: number) => H - (c / maxY) * H;
  const path = (vals: number[]) => vals.map((c, r) => `${r === 0 ? 'M' : 'L'} ${x(r).toFixed(2)} ${y(c).toFixed(2)}`).join(' ');

  const toggleLoss = (r: number) => setLosses((l) => (l.includes(r) ? l.filter((x) => x !== r) : [...l, r].sort((a, b) => a - b)));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>TCP CUBIC — the modern window curve</h2></div>
        <p className="jsec-sub">
          Reno adds one segment per round-trip — a slow linear climb that leaves fast, long-distance links half-empty. CUBIC instead
          grows the window along a <strong>cubic curve</strong> of time since the last loss: it rushes back toward the window it had
          before (<em>W<sub>max</sub></em>), eases off right around it to probe gently, then accelerates past it to find new headroom —
          and it does this independently of RTT. Compare the two:
        </p>

        <div className="cub-chart">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {losses.map((r) => <line key={r} x1={x(r)} y1={0} x2={x(r)} y2={H} className="cub-loss" />)}
            <path d={path(renoT)} className="cub-reno" vectorEffect="non-scaling-stroke" />
            <path d={path(cubic.map((c) => c.cwnd))} className="cub-cubic" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className="cub-legend">
          <span><i className="cub-k cubic" /> CUBIC</span>
          <span><i className="cub-k reno" /> Reno (+1/RTT)</span>
          <span><i className="cub-k loss" /> loss event</span>
        </div>

        <div className="cub-rounds">
          <span className="cub-hint">click a round to toggle a loss there:</span>
          <div className="cub-ticks">
            {Array.from({ length: ROUNDS }, (_, r) => (
              <button key={r} className={`cub-tick ${losses.includes(r) ? 'on' : ''}`} onClick={() => toggleLoss(r)} title={`round ${r}`} />
            ))}
          </div>
        </div>

        <p className="cub-foot">
          The shape comes straight from <code>W(t) = C·(t − K)³ + W<sub>max</sub></code> with C = 0.4, where after a loss the window
          drops to 0.7·W<sub>max</sub> (gentler than Reno’s halving) and K = ∛(W<sub>max</sub>·0.3/0.4) sets how long the climb back
          takes. Because t is measured in time, not ACKs, CUBIC is fair across different RTTs — Reno favours short-RTT flows. Its
          successor BBR abandons loss as the signal entirely, modelling the path’s bandwidth and RTT directly to avoid filling buffers
          (bufferbloat) at all.
        </p>
      </section>
    </div>
  );
}
