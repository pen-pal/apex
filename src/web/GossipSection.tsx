// Gossip / epidemic spread, made visible. One node starts with the news; each round
// every informed node tells `fanout` random peers, and you watch the cluster light
// up in the classic S-curve — slow start, explosive middle, saturating tail —
// converging in ~log_fanout(N) rounds. Deterministic (seeded) so it's reproducible.
// Real model (see gossip.ts).
import { useEffect, useMemo, useState } from 'react';
import { gossip } from './gossip';

const CW = 560, CH = 150, L = 34, B = 22, T = 8;
const PW = CW - L - 8, PH = CH - T - B;

export function GossipSection() {
  const [n, setN] = useState(64);
  const [fanout, setFanout] = useState(2);
  const [seed, setSeed] = useState(1);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const g = useMemo(() => gossip(n, fanout, seed), [n, fanout, seed]);
  const maxRound = g.rounds.length - 1;
  const cols = Math.ceil(Math.sqrt(n));

  useEffect(() => { setStep(0); }, [n, fanout, seed]);
  useEffect(() => {
    if (!playing) return;
    if (step >= maxRound) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, maxRound)), 600);
    return () => clearTimeout(id);
  }, [playing, step, maxRound]);

  const cur = g.rounds[Math.min(step, maxRound)];
  const newly = new Set(cur.newlyInformed);

  const x = (r: number) => L + (maxRound ? (r / maxRound) * PW : 0);
  const y = (c: number) => T + PH - (c / n) * PH;
  const curve = g.rounds.slice(0, step + 1).map((r, i) => `${i === 0 ? 'M' : 'L'}${x(r.round)},${y(r.count)}`).join(' ');

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Gossip — spreading news through a cluster</h2></div>
        <p className="jsec-sub">
          No central coordinator: one node learns something, and each round every node that knows it tells a few random
          peers. The number informed traces an <strong>S-curve</strong> — slow to start, then explosive, then tapering as
          the last stragglers get reached — and the whole cluster converges in about <strong>log(N)</strong> rounds.
          It’s how clusters share membership and config, robustly. Step it.
        </p>

        <div className="gs-controls">
          <label>nodes: {n}<input type="range" min={16} max={144} step={4} value={n} onChange={(e) => setN(+e.target.value)} /></label>
          <label>fanout: {fanout}<input type="range" min={1} max={6} value={fanout} onChange={(e) => setFanout(+e.target.value)} /></label>
          <button className="ghost small" onClick={() => setSeed((s) => s + 1)}>🔀 reshuffle</button>
          <div className="gs-play">
            <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮</button>
            <button className="ghost small" disabled={step >= maxRound} onClick={() => { setStep((s) => Math.min(maxRound, s + 1)); setPlaying(false); }}>round →</button>
            <button className="ghost small" onClick={() => { if (step >= maxRound) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶'}</button>
            <button className="ghost small" onClick={() => { setStep(maxRound); setPlaying(false); }}>all</button>
          </div>
        </div>

        <div className="gs-readout">
          round <strong>{cur.round}</strong> · <strong>{cur.count}/{n}</strong> informed ({Math.round((cur.count / n) * 100)}%)
          {g.roundsToFull > 0 && <span className="gs-conv"> · converged in {g.roundsToFull} rounds (≈ log<sub>{fanout + 1}</sub> {n})</span>}
        </div>

        <div className="gs-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: n }, (_, i) => {
            const inf = cur.informed[i];
            const isNew = newly.has(i);
            const isSeed = i === 0;
            return <span key={i} className={`gs-node ${inf ? 'inf' : ''} ${isNew ? 'new' : ''} ${isSeed ? 'seed' : ''}`} title={isSeed ? 'patient zero' : ''} />;
          })}
        </div>

        <svg className="gs-svg" viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="informed over time">
          {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} y1={y(n * f)} x2={CW - 8} y2={y(n * f)} className="cc-grid" /><text x={L - 6} y={y(n * f) + 3} className="cc-axis">{Math.round(n * f)}</text></g>)}
          <path d={curve} className="gs-curve" />
          {g.rounds.slice(0, step + 1).map((r) => <circle key={r.round} cx={x(r.round)} cy={y(r.count)} r={2.5} className="gs-pt" />)}
          <text x={L + PW / 2} y={CH - 4} className="cc-axis" textAnchor="middle">round →</text>
        </svg>
        <p className="enc-note">Gossip is robust because it has no leader and no single path: messages take many random routes, so losing nodes
          barely slows it. The cost is redundancy (nodes hear the same news several times) and eventual — not instant — consistency. SWIM, Serf, and
          Cassandra’s cluster membership all run on this.</p>
      </section>
    </div>
  );
}
