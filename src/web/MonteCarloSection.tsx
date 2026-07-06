// Guided story: Monte Carlo — estimate a quantity by random sampling. Throw random darts at a unit square with an
// inscribed quarter-circle; the fraction inside is the area ratio π/4, so 4× that fraction estimates π. DEEPENED so
// you PRODUCE the two truths people never internalize, instead of reading them:
//  · the answer is RANDOM — run N darts many times and you get a spread of estimates, not one number.
//  · convergence is 1/√N and therefore SLOW — step N up ×4 and the spread only HALVES (not quarters). 100× the
//    darts buys one more digit. The run scene throws 140 independent runs at a chosen N and histograms the answers;
//    the spread visibly halves each ×4, matching theory σ = 4·√((π/4)(1−π/4)/N).
// Node-verified: σ(N=100..25600) = 0.164, 0.082, 0.041, 0.021, 0.010 — exactly halving per ×4; estimate → 3.14159.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const OX = 250, OY = 20, SZ = 360;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + SZ * (1 - y);
const CAP = 2800;
const P = Math.PI / 4;
const NS = [100, 400, 1600, 6400, 25600];
const RUNS = 140; // independent trials histogrammed in the run scene
const theorySigma = (n: number) => 4 * Math.sqrt((P * (1 - P)) / n);

type Phase = 'darts' | 'lln' | 'rate' | 'dimension' | 'uses' | 'run';

export function MonteCarloSection() {
  // live dart-throwing for the mechanism scenes
  const inside = useRef(0); const total = useRef(0);
  const darts = useRef<{ x: number; y: number; in: boolean }[]>([]);
  const [, tick] = useState(0); const frame = useRef(0);
  useEffect(() => {
    let raf = 0; const loop = () => { frame.current++;
      if (total.current < 40000) { for (let i = 0; i < 45; i++) { const x = Math.random(), y = Math.random(); const hit = x * x + y * y <= 1; total.current++; if (hit) inside.current++; if (darts.current.length < CAP) darts.current.push({ x, y, in: hit }); } tick((t) => (t + 1) % 100000); }
      raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  const est = () => total.current ? 4 * inside.current / total.current : 0;

  // run scene: RUNS independent trials of n darts each → a distribution of estimates
  const [n, setN] = useState(400);
  const [roll, setRoll] = useState(0);
  const trials = useMemo(() => {
    const e: number[] = [];
    for (let t = 0; t < RUNS; t++) { let ins = 0; for (let i = 0; i < n; i++) { const x = Math.random(), y = Math.random(); if (x * x + y * y <= 1) ins++; } e.push(4 * ins / n); }
    return e;
  }, [n, roll]);
  const measured = useMemo(() => { const m = trials.reduce((s, v) => s + v, 0) / trials.length; return Math.sqrt(trials.reduce((s, v) => s + (v - m) ** 2, 0) / trials.length); }, [trials]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <MC phase={key} darts={darts.current} inside={inside.current} total={total.current} est={est()} /> });

  const scenes: StoryScene[] = [
    scene('darts', 'Estimate by throwing darts', 'Some quantities are hard to compute exactly but easy to sample. To get π: throw darts uniformly at a 1×1 square with a quarter-circle (radius 1) inscribed. A dart lands inside the arc when x²+y² ≤ 1. The fraction that land inside is the ratio of the areas — π/4 — so four times that fraction estimates π.'),
    scene('lln', 'The law of large numbers', 'With a few dozen darts the estimate is jumpy and often far off. Throw thousands and it settles toward the true value: the average of independent random samples converges to the expected value. Watch the number home in on 3.14159 as the square fills.'),
    scene('rate', 'Error shrinks as 1 over √N', 'The cost is the rate. The standard error of an average of N samples falls like 1/√N — so to halve the error you must quadruple the darts. A hundred times the samples buys only ten times the accuracy. Slow, but utterly predictable: you know exactly how many samples a target precision needs.'),
    scene('dimension', 'Dimension doesn’t matter', 'This is why Monte Carlo is indispensable: the 1/√N error rate holds no matter how many dimensions you integrate over. A grid needs N points per axis — Nᵈ in d dimensions, hopeless past a handful — but random sampling only cares about the total count and the variance, not the dimension. Same law in 2-D or 200-D.'),
    scene('uses', 'Where it’s used', 'Anywhere an exact integral or expectation is out of reach, sample it: pricing financial options, simulating neutron transport and statistical mechanics, path-tracing photorealistic images (integrating light over all paths), and Bayesian inference (MCMC sampling a posterior). When you can’t integrate, you sample.'),
    { key: 'run', title: 'It’s random, and it’s slow — see both', caption: 'Now the two things captions can’t teach. Pick how many darts N each run gets, and 140 independent runs are thrown and histogrammed. First: the answers SCATTER — one run isn’t π, it’s a draw from a distribution around π (hit “throw again” and the whole histogram reshuffles). Second: step N up ×4 and the spread only HALVES — 4× the work for half the error. That’s 1/√N: it takes 100× the darts to earn one more digit. Simple and dimension-proof, but slow.', render: () => <Hist n={n} trials={trials} measured={measured} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Some quantities are hard to compute exactly but easy to sample. <strong>Monte Carlo</strong> estimates them by random sampling: to get π, throw random darts at a unit square with a quarter-circle inscribed and count the fraction that land inside — that fraction is the area ratio π/4, so four times it estimates π. Throw more darts and the estimate converges to the true value; the error shrinks like <strong>1/√N</strong>, a rate that (crucially) doesn’t depend on how many dimensions you’re working in. Two things you only really believe once you’ve produced them: the answer is <em>random</em>, and it converges <em>slowly</em>.</>,
        takeaway: <>Monte Carlo turns a hard integral or expectation into an <strong>average of random samples</strong>. For π: a dart uniform in the unit square lands inside the inscribed quarter-circle with probability equal to its area, π/4, so the sample fraction inside × 4 is an unbiased estimator of π. The <strong>law of large numbers</strong> guarantees convergence, and the <strong>central limit theorem</strong> pins the error: the standard error of an average of N i.i.d. samples is σ/√N, so accuracy improves as 1/√N — to halve the error you quadruple the samples (produce it here: N goes ×4, the histogram of 140 runs narrows by exactly ~2×). That 1/√N rate is slow but has a decisive property: it is <strong>independent of dimension</strong>. A deterministic grid needs N points per axis — Nᵈ for d dimensions — and becomes impossible past a few dimensions (the curse of dimensionality), whereas Monte Carlo’s error depends only on the sample count and the variance, not on d. That’s why it dominates high-dimensional integration across physics (neutron transport, statistical mechanics), finance (option pricing), computer graphics (path tracing integrates light over all paths), and Bayesian statistics (MCMC samples the posterior). Variance-reduction tricks — importance sampling, stratification, quasi-random (low-discrepancy) sequences — buy accuracy without more samples, but the core idea stands: when you can’t integrate, sample.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="dart-ctl">
          <div className="dart-ctl-row">
            <span className="dart-ctl-lbl">darts per run</span>
            {NS.map((v) => <button key={v} type="button" className={`dart-btn ${n === v ? 'on' : ''}`} onClick={() => setN(v)}>{v.toLocaleString()}</button>)}
            <button type="button" className="dart-btn" onClick={() => setRoll((r) => r + 1)}>↻ throw again</button>
          </div>
          <span className="dart-live">
            {RUNS} runs of N={n.toLocaleString()} · spread of the answers ≈ <b>{measured.toFixed(3)}</b> (theory 4·√((π/4)(1−π/4)/N) = {theorySigma(n).toFixed(3)}) · one more ×4 in N ⇒ ≈{(theorySigma(n) / 2).toFixed(3)}
          </span>
        </div>
      )}
    />
  );
}

function MC({ phase, darts, inside, total, est }: { phase: Phase; darts: { x: number; y: number; in: boolean }[]; inside: number; total: number; est: number }) {
  const on = (p: Phase) => phase === p;
  const err = Math.abs(est - Math.PI);
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="24" className="dart-col">unit square + quarter-circle{total ? ` · ${inside.toLocaleString()}/${total.toLocaleString()} inside · π ≈ ${est.toFixed(4)}` : ''}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="dart-frame" />
      <path d={`M ${sx(0)} ${sy(1)} A ${SZ} ${SZ} 0 0 1 ${sx(1)} ${sy(0)}`} className="dart-arc" />
      {darts.map((d, i) => <circle key={i} cx={sx(d.x)} cy={sy(d.y)} r="1.7" className={`dart-pt ${d.in ? 'in' : 'out'}`} />)}
      {total > 0 && <>
        <text x={OX + SZ + 24} y={OY + 40} className="dart-est">π ≈ {est.toFixed(4)}</text>
        <text x={OX + SZ + 24} y={OY + 66} className="dart-sub">true {Math.PI.toFixed(4)}</text>
        <text x={OX + SZ + 24} y={OY + 100} className="dart-sub">N = {total.toLocaleString()}</text>
        <text x={OX + SZ + 24} y={OY + 124} className="dart-sub">error {err.toFixed(4)}</text>
        {(on('rate') || on('dimension')) && <text x={OX + SZ + 24} y={OY + 158} className="dart-sub">1/√N ≈ {(1 / Math.sqrt(total)).toFixed(4)}</text>}
      </>}
      <text x="450" y="404" className="dart-foot" textAnchor="middle">
        {on('darts') ? 'fraction inside = π/4 → four times it estimates π'
          : on('lln') ? 'more darts → the running average converges to π'
          : on('rate') ? 'error ∝ 1/√N: quadruple the darts to halve the error'
          : on('dimension') ? 'the 1/√N rate is the same in any number of dimensions'
          : 'sample when you cannot integrate — finance, physics, rendering'}
      </text>
    </svg>
  );
}

// The run scene: a histogram of RUNS independent π-estimates at the chosen N. Random spread, narrowing as 1/√N.
const AX0 = Math.PI - 0.6, AX1 = Math.PI + 0.6, HX0 = 120, HXW = 660, BINS = 24;
const hxpx = (e: number) => HX0 + Math.max(0, Math.min(1, (e - AX0) / (AX1 - AX0))) * HXW;
function Hist({ n, trials, measured }: { n: number; trials: number[]; measured: number }) {
  const binW = (AX1 - AX0) / BINS;
  const counts = new Array(BINS).fill(0);
  for (const e of trials) counts[Math.max(0, Math.min(BINS - 1, Math.floor((e - AX0) / binW)))]++;
  const maxC = Math.max(1, ...counts);
  const baseY = 320, H = 210, bw = HXW / BINS;
  const piX = hxpx(Math.PI);
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="26" className="dart-col">{trials.length} runs · N = {n.toLocaleString()} darts each · every run gives a DIFFERENT π</text>
      {/* histogram bars */}
      {counts.map((c, i) => c > 0 && (
        <rect key={i} x={HX0 + i * bw + 0.5} y={baseY - (c / maxC) * H} width={bw - 1} height={(c / maxC) * H} className="dart-hbar" />
      ))}
      {/* true-π line */}
      <line x1={piX} y1={baseY - H - 6} x2={piX} y2={baseY + 8} className="dart-pi" />
      <text x={piX} y={baseY - H - 12} className="dart-pilbl" textAnchor="middle">true π = 3.14159</text>
      {/* axis ticks */}
      {[Math.PI - 0.5, Math.PI - 0.25, Math.PI, Math.PI + 0.25, Math.PI + 0.5].map((v, i) => (
        <text key={i} x={hxpx(v)} y={baseY + 26} className="dart-tick" textAnchor="middle">{v.toFixed(2)}</text>
      ))}
      <line x1={HX0} y1={baseY} x2={HX0 + HXW} y2={baseY} className="dart-axis" />
      {/* spread bracket */}
      <line x1={hxpx(Math.PI - measured)} y1={baseY + 44} x2={hxpx(Math.PI + measured)} y2={baseY + 44} className="dart-spread" />
      <text x={piX} y={baseY + 62} className="dart-spread-lbl" textAnchor="middle">± one spread (σ ≈ {measured.toFixed(3)}) — 4× the darts would halve this</text>
    </svg>
  );
}
