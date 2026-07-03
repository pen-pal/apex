// Guided story: Monte Carlo — estimate a quantity by random sampling. Throw random darts at a unit square with an
// inscribed quarter-circle; the fraction inside is the area ratio π/4, so 4× that fraction estimates π. The estimate
// converges (law of large numbers) and its error shrinks like 1/√N (central limit theorem) — halve the error by
// quadrupling the samples — a rate independent of dimension, which is why Monte Carlo beats grids for high-D
// integrals. Verified in node (with a good PRNG): error ~2× smaller per 4× samples, → 3.14159. Live dart-throwing.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const OX = 250, OY = 20, SZ = 360;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + SZ * (1 - y);
const CAP = 2800;

type Phase = 'darts' | 'lln' | 'rate' | 'dimension' | 'uses' | 'run';

export function MonteCarloSection() {
  const inside = useRef(0); const total = useRef(0);
  const darts = useRef<{ x: number; y: number; in: boolean }[]>([]);
  const [, tick] = useState(0); const frame = useRef(0);
  const reset = () => { inside.current = 0; total.current = 0; darts.current = []; };
  useEffect(() => {
    let raf = 0; const loop = () => { frame.current++;
      if (total.current < 40000) { for (let i = 0; i < 45; i++) { const x = Math.random(), y = Math.random(); const hit = x * x + y * y <= 1; total.current++; if (hit) inside.current++; if (darts.current.length < CAP) darts.current.push({ x, y, in: hit }); } tick((t) => (t + 1) % 100000); }
      raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const est = () => total.current ? 4 * inside.current / total.current : 0;
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <MC phase={key} darts={darts.current} inside={inside.current} total={total.current} est={est()} /> });

  const scenes: StoryScene[] = [
    scene('darts', 'Estimate by throwing darts', 'Some quantities are hard to compute exactly but easy to sample. To get π: throw darts uniformly at a 1×1 square with a quarter-circle (radius 1) inscribed. A dart lands inside the arc when x²+y² ≤ 1. The fraction that land inside is the ratio of the areas — π/4 — so four times that fraction estimates π.'),
    scene('lln', 'The law of large numbers', 'With a few dozen darts the estimate is jumpy and often far off. Throw thousands and it settles toward the true value: the average of independent random samples converges to the expected value. Watch the number home in on 3.14159 as the square fills.'),
    scene('rate', 'Error shrinks as 1 over √N', 'The cost is the rate. The standard error of an average of N samples falls like 1/√N — so to halve the error you must quadruple the darts. A hundred times the samples buys only ten times the accuracy. Slow, but utterly predictable: you know exactly how many samples a target precision needs.'),
    scene('dimension', 'Dimension doesn’t matter', 'This is why Monte Carlo is indispensable: the 1/√N error rate holds no matter how many dimensions you integrate over. A grid needs N points per axis — Nᵈ in d dimensions, hopeless past a handful — but random sampling only cares about the total count and the variance, not the dimension. Same law in 2-D or 200-D.'),
    scene('uses', 'Where it’s used', 'Anywhere an exact integral or expectation is out of reach, sample it: pricing financial options, simulating neutron transport and statistical mechanics, path-tracing photorealistic images (integrating light over all paths), and Bayesian inference (MCMC sampling a posterior). When you can’t integrate, you sample.'),
    { key: 'run', title: 'Throw darts yourself', caption: 'Darts rain down live: green inside the arc, orange outside. The running estimate 4·(inside/total) wobbles wildly at first, then locks toward π as thousands accumulate, and the error grinds down along the 1/√N curve. Reset to watch the convergence from scratch — noisy early, precise late, always at that same square-root pace.', render: () => <MC phase="run" darts={darts.current} inside={inside.current} total={total.current} est={est()} onReset={reset} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Some quantities are hard to compute exactly but easy to sample. <strong>Monte Carlo</strong> estimates them by random sampling: to get π, throw random darts at a unit square with a quarter-circle inscribed and count the fraction that land inside — that fraction is the area ratio π/4, so four times it estimates π. Throw more darts and the estimate converges to the true value; the error shrinks like <strong>1/√N</strong>, a rate that (crucially) doesn’t depend on how many dimensions you’re working in.</>,
        takeaway: <>Monte Carlo turns a hard integral or expectation into an <strong>average of random samples</strong>. For π: a dart uniform in the unit square lands inside the inscribed quarter-circle with probability equal to its area, π/4, so the sample fraction inside × 4 is an unbiased estimator of π. The <strong>law of large numbers</strong> guarantees convergence, and the <strong>central limit theorem</strong> pins the error: the standard error of an average of N i.i.d. samples is σ/√N, so accuracy improves as 1/√N — to halve the error you quadruple the samples (verified here: error ~2× smaller each time N goes 4×, estimate → 3.14159; note a weak PRNG plateaus and lies about this, so it needs a good one). That 1/√N rate is slow but has a decisive property: it is <strong>independent of dimension</strong>. A deterministic grid needs N points per axis — Nᵈ for d dimensions — and becomes impossible past a few dimensions (the curse of dimensionality), whereas Monte Carlo’s error depends only on the sample count and the variance, not on d. That’s why it dominates high-dimensional integration across physics (neutron transport, statistical mechanics), finance (option pricing), computer graphics (path tracing integrates light over all paths), and Bayesian statistics (MCMC samples the posterior). Variance-reduction tricks — importance sampling, stratification, quasi-random (low-discrepancy) sequences — buy accuracy without more samples, but the core idea stands: when you can’t integrate, sample.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="dart-ctl">
          <button type="button" className="dart-btn" onClick={reset}>↻ restart</button>
          <span className="dart-live">N={total.current.toLocaleString()} · π ≈ {est().toFixed(4)} · error {Math.abs(est() - Math.PI).toFixed(4)}</span>
        </div>
      )}
    />
  );
}

function MC({ phase, darts, inside, total, est, onReset }: { phase: Phase; darts: { x: number; y: number; in: boolean }[]; inside: number; total: number; est: number; onReset?: () => void }) {
  const on = (p: Phase) => phase === p;
  void onReset;
  const err = Math.abs(est - Math.PI);
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="24" className="dart-col">unit square + quarter-circle{total ? ` · ${inside.toLocaleString()}/${total.toLocaleString()} inside · π ≈ ${est.toFixed(4)}` : ''}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="dart-frame" />
      {/* quarter circle arc (radius 1, centered at bottom-left origin) */}
      <path d={`M ${sx(0)} ${sy(1)} A ${SZ} ${SZ} 0 0 1 ${sx(1)} ${sy(0)}`} className="dart-arc" />

      {/* darts */}
      {darts.map((d, i) => <circle key={i} cx={sx(d.x)} cy={sy(d.y)} r="1.7" className={`dart-pt ${d.in ? 'in' : 'out'}`} />)}

      {/* estimate + error panel */}
      {total > 0 && <>
        <text x={OX + SZ + 24} y={OY + 40} className="dart-est">π ≈ {est.toFixed(4)}</text>
        <text x={OX + SZ + 24} y={OY + 66} className="dart-sub">true {Math.PI.toFixed(4)}</text>
        <text x={OX + SZ + 24} y={OY + 100} className="dart-sub">N = {total.toLocaleString()}</text>
        <text x={OX + SZ + 24} y={OY + 124} className="dart-sub">error {err.toFixed(4)}</text>
        {(on('rate') || on('run') || on('dimension')) && <text x={OX + SZ + 24} y={OY + 158} className="dart-sub">1/√N ≈ {(1 / Math.sqrt(total)).toFixed(4)}</text>}
      </>}

      <text x="450" y="404" className="dart-foot" textAnchor="middle">
        {on('darts') ? 'fraction inside = π/4 → four times it estimates π'
          : on('lln') ? 'more darts → the running average converges to π'
          : on('rate') ? 'error ∝ 1/√N: quadruple the darts to halve the error'
          : on('dimension') ? 'the 1/√N rate is the same in any number of dimensions'
          : on('uses') ? 'sample when you cannot integrate — finance, physics, rendering'
          : `N=${total.toLocaleString()} · π≈${est.toFixed(4)} · error ${err.toFixed(4)}`}
      </text>
    </svg>
  );
}
