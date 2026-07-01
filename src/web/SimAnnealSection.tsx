// Simulated annealing, made visible. A cost landscape with a shallow trap and a deep global valley. Greedy
// descent rolls straight into the nearest dip and stops; annealing, kept "hot" at first, accepts uphill moves and
// can climb out of the trap to find the deep valley — then cools and settles. Change the seed to see that it's
// probabilistic: sometimes it escapes, sometimes it doesn't. Real logic from simulanneal.ts.
import { useMemo, useState } from 'react';
import { makeLandscape, greedyDescent, anneal, makeRng } from './simulanneal';

const START = 50, OPTS = { T0: 12, alpha: 0.998, steps: 4000 };
const land = makeLandscape(60);
const maxC = Math.max(...land);

export function SimAnnealSection() {
  const [seed, setSeed] = useState(2);
  const greedy = useMemo(() => greedyDescent(land, START), []);
  const sa = useMemo(() => anneal(land, START, OPTS, makeRng(seed)), [seed]);

  const W = 660, H = 220, PAD = 14;
  const px = (i: number) => PAD + (i / (land.length - 1)) * (W - 2 * PAD);
  const py = (c: number) => (H - PAD) - (c / maxC) * (H - 2 * PAD); // low cost → bottom (valley), high cost → top (barrier)
  const curve = land.map((c, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(c).toFixed(1)}`).join(' ');

  // sample the SA trajectory (visited indices) to draw the exploration trail
  const trail = sa.path.filter((_, k) => k % 12 === 0);
  const escaped = sa.best < 28;

  return (
    <div className="san">
      <p className="san-intro">
        Greedy optimization always moves downhill — so it rolls into the first dip and stops, even if a far deeper
        valley sits over the next ridge. <strong>Simulated annealing</strong> keeps a <strong>temperature</strong>
        that starts high and cools: while hot it accepts uphill moves with probability <code>exp(−ΔE/T)</code>, so
        it can climb out of a trap; as it cools it accepts only improvements and settles. Change the seed — it's
        probabilistic.
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="san-land">
        <path d={`${curve} L${px(land.length - 1)},${H - PAD} L${px(0)},${H - PAD} Z`} className="san-fill" />
        <path d={curve} className="san-curve" />
        {trail.map((s, k) => <circle key={k} cx={px(s.i)} cy={py(land[s.i])} r={2.4} className={`san-dot ${s.dE > 0 && s.accepted ? 'up' : ''}`} />)}
        <g className="san-marker"><circle cx={px(START)} cy={py(land[START])} r={5} className="san-start" /><text x={px(START)} y={py(land[START]) - 9} textAnchor="middle">start</text></g>
        <g className="san-marker red"><circle cx={px(greedy.end)} cy={py(land[greedy.end])} r={5} /><text x={px(greedy.end)} y={py(land[greedy.end]) - 11} textAnchor="middle">greedy stuck</text></g>
        <g className={`san-marker ${escaped ? 'green' : 'amber'}`}><circle cx={px(sa.best)} cy={py(land[sa.best])} r={5} /><text x={px(sa.best)} y={py(land[sa.best]) - 11} textAnchor="middle">annealing best</text></g>
      </svg>
      <div className="san-legend"><span className="san-lg up">• uphill move accepted (escaping)</span><span className="san-lg dn">• downhill/lateral</span></div>

      <div className="san-controls">
        <label>seed <input type="range" min={1} max={40} value={seed} onChange={(e) => setSeed(+e.target.value)} /> <b>{seed}</b></label>
        <span className="san-hint">{escaped ? '✓ this run escaped the trap' : '✗ this run got stuck too — try another seed'}</span>
      </div>

      <div className="san-stats">
        <div className="san-stat bad"><span>greedy result</span><b>{land[greedy.end].toFixed(1)}</b><small>local min (idx {greedy.end})</small></div>
        <div className={`san-stat ${escaped ? 'good' : ''}`}><span>annealing best</span><b>{land[sa.best].toFixed(1)}</b><small>{escaped ? 'global valley' : 'still trapped'} (idx {sa.best})</small></div>
        <div className="san-stat"><span>uphill moves taken</span><b>{sa.path.filter((s) => s.dE > 0 && s.accepted).length}</b><small>impossible for greedy</small></div>
      </div>

      <p className="san-foot">
        The whole method rests on one honest bargain: to find a better answer you must sometimes accept a worse one.
        A pure hill-climber can't, so it's at the mercy of where it started; annealing pays a little short-term cost
        (uphill moves) to buy long-term freedom (escaping traps), and the temperature schedule tunes that
        trade-off — hot for exploration, cold for exploitation. Cool too fast and it freezes in a trap like greedy;
        cool infinitely slowly and theory guarantees the global optimum, but that's impractical, so real use is an
        art of schedules and restarts. It shines exactly where calculus can't help: rugged, discrete landscapes
        with no gradient — placing millions of gates on a chip, routing a delivery fleet, packing a warehouse,
        folding a protein. The same "accept-worse-to-escape" idea reappears across optimization: genetic algorithms
        keep a diverse population so no single point can get stuck, and stochastic gradient descent's very noise
        helps neural-network training skip past sharp local minima. All of them are answers to the same trap you
        watched greedy fall into. (Kirkpatrick, Gelatt &amp; Vecchi, <em>Science</em>, 1983; Metropolis et al., 1953.)
      </p>
    </div>
  );
}
