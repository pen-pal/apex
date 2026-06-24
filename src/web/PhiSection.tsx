// The phi-accrual failure detector, made visible. A node sends heartbeats over a jittery link;
// the detector turns the silence-since-the-last-beat into a continuous suspicion level phi. Drag the
// phi threshold and a naive fixed timeout and watch the difference: the fixed timeout false-alarms on
// a normal jitter spike or a GC pause, while phi adapts to the observed variance and only fires on a
// genuine crash. All values from phi.ts (tested against the normal-distribution formula).
import { useMemo, useState } from 'react';
import { phiAt } from './phi';

const W = 620, H = 170, PAD = 30, PHIMAX = 16;
// a genuinely jittery link (σ ≈ 32 ms): normal gaps run up to ~170 ms, so a tight fixed timeout
// false-alarms while φ stays calibrated to that spread.
const JIT = [100, 62, 148, 78, 132, 168, 72, 118, 92, 158, 80, 140, 108, 66, 150, 90, 120, 84, 136, 100];

function arrivalsFrom(intervals: number[]): number[] {
  let t = 0; const a = [0];
  for (const d of intervals) { t += d; a.push(t); }
  return a;
}
const SCENARIOS: Record<string, { label: string; arrivals: number[]; horizon: number; blurb: string }> = {
  healthy: { label: 'healthy (jittery)', arrivals: arrivalsFrom([...JIT, ...JIT]), horizon: 2300, blurb: 'normal beats with heavy link jitter — nothing is actually wrong' },
  gc: { label: 'GC pause, then recovers', arrivals: arrivalsFrom([...JIT.slice(0, 10), 250, ...JIT.slice(0, 8)]), horizon: 2300, blurb: 'one long stall (a 250 ms GC pause) — the node is alive, just slow' },
  crash: { label: 'crash (beats stop)', arrivals: arrivalsFrom(JIT.slice(0, 11)), horizon: 2300, blurb: 'heartbeats stop dead at ~1.2 s — the node really is gone' },
};

export function PhiSection() {
  const [scn, setScn] = useState('gc');
  const [threshold, setThreshold] = useState(8);
  const [fixedMs, setFixedMs] = useState(160);
  const { arrivals, horizon, blurb } = SCENARIOS[scn];

  const series = useMemo(() => {
    const pts: { t: number; phi: number; gap: number }[] = [];
    for (let t = 0; t <= horizon; t += 15) {
      const seen = arrivals.filter((a) => a <= t);
      const gap = seen.length ? t - seen[seen.length - 1] : 0;
      pts.push({ t, phi: phiAt(arrivals, t), gap });
    }
    return pts;
  }, [arrivals, horizon]);

  const phiFire = series.find((p) => p.phi > threshold)?.t ?? null;
  const fixedFire = series.find((p) => p.gap > fixedMs)?.t ?? null;
  const crashed = scn === 'crash';

  const x = (t: number) => PAD + (t / horizon) * (W - 2 * PAD);
  const yPhi = (p: number) => H - PAD - (Math.min(p, PHIMAX) / PHIMAX) * (H - 2 * PAD);
  const area = series.map((p) => `${x(p.t)},${yPhi(p.phi)}`).join(' ');

  const verdict = (fire: number | null) => {
    if (crashed) return fire ? `✓ detected the crash at ${fire} ms` : '✗ missed the crash';
    return fire ? `✗ FALSE ALARM at ${fire} ms (node was fine)` : `✓ stayed calm (no false alarm)`;
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Phi-accrual failure detection — suspicion, not a binary timeout</h2></div>
        <p className="jsec-sub">
          Deciding a peer is dead with a fixed timeout is a trap: too short and you false-alarm on a GC pause or a jitter spike; too long and
          you’re slow to react. The <strong>phi-accrual</strong> detector instead outputs a continuous <strong>suspicion level φ</strong> from
          the recent heartbeat statistics — <code>φ = −log₁₀ P(a beat arrives even later than we’ve already waited)</code> — and adapts to the
          link’s own jitter. You pick a threshold (φ&gt;8 ≈ a 1-in-10⁸ chance the node is merely slow).
        </p>

        <div className="phi-scns">
          {Object.entries(SCENARIOS).map(([k, s]) => (
            <button key={k} className={`phi-scn ${scn === k ? 'on' : ''}`} onClick={() => setScn(k)}>{s.label}</button>
          ))}
          <span className="phi-blurb">{blurb}</span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="phi-svg" role="img" aria-label="phi over time">
          {/* threshold line */}
          <line x1={PAD} y1={yPhi(threshold)} x2={W - PAD} y2={yPhi(threshold)} className="phi-thresh" />
          <text x={W - PAD} y={yPhi(threshold) - 4} className="phi-threshlbl" textAnchor="end">φ threshold = {threshold}</text>
          {/* phi area */}
          <polyline points={`${PAD},${H - PAD} ${area} ${W - PAD},${H - PAD}`} className="phi-area" />
          <polyline points={area} className="phi-line" />
          {/* heartbeat ticks */}
          {arrivals.filter((a) => a <= horizon).map((a, i) => (
            <line key={i} x1={x(a)} y1={H - PAD} x2={x(a)} y2={H - PAD + 7} className="phi-beat" />
          ))}
          {/* fire markers */}
          {phiFire != null && <line x1={x(phiFire)} y1={PAD - 6} x2={x(phiFire)} y2={H - PAD} className="phi-fire phi" />}
          {fixedFire != null && <line x1={x(fixedFire)} y1={PAD - 6} x2={x(fixedFire)} y2={H - PAD} className="phi-fire fixed" />}
          <text x={PAD} y={12} className="phi-axislbl">φ</text>
          <text x={W - PAD} y={H - 6} className="phi-axislbl" textAnchor="end">time →</text>
        </svg>

        <div className="phi-ctrls">
          <label>φ threshold <input type="range" min={2} max={15} value={threshold} onChange={(e) => setThreshold(+e.target.value)} /><b>{threshold}</b></label>
          <label>fixed timeout <input type="range" min={150} max={500} step={10} value={fixedMs} onChange={(e) => setFixedMs(+e.target.value)} /><b>{fixedMs} ms</b></label>
        </div>

        <div className="phi-verdicts">
          <div className={`phi-verdict phi ${(!crashed && phiFire) ? 'bad' : 'good'}`}><span className="phi-vlbl">φ-accrual (threshold {threshold})</span>{verdict(phiFire)}</div>
          <div className={`phi-verdict fixed ${(!crashed && fixedFire) ? 'bad' : 'good'}`}><span className="phi-vlbl">fixed timeout ({fixedMs} ms)</span>{verdict(fixedFire)}</div>
        </div>

        <p className="phi-foot">
          The win is one knob with a probabilistic meaning instead of a magic millisecond number: φ is comparable across links because it’s
          expressed in orders of magnitude of unlikelihood, and it widens its own tolerance when the network gets jittery. Try the GC-pause
          scenario — the 160 ms fixed timeout false-alarms on the 250 ms stall, but φ only reaches ≈5.3 (a 1-in-200k event on this link) and stays
          calm, then still catches the real crash once φ climbs past 8. Cassandra, Akka Cluster, and Hazelcast all ship a phi-accrual detector for exactly this reason.
        </p>
      </section>
    </div>
  );
}
