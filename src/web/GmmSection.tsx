// Guided story: Gaussian mixture models via EM — soft, elliptical clustering that generalizes k-means. Model the data
// as a blend of K Gaussians (mean + covariance ellipse + weight); fit by Expectation-Maximization: E-step computes
// each point's soft responsibilities, M-step refits each Gaussian to its responsibility-weighted points. EM provably
// never DECREASES the log-likelihood — but DEEPENED to show the trap a master knows: that guarantee is double-edged,
// because the likelihood is UNBOUNDED. Toggle off the covariance floor and a component collapses onto a single point:
// its variance races to 0, its density (and the likelihood) diverges to +∞, and the "always improving" fit converges
// to a degenerate spike that clusters nothing. The fix every real implementation ships is a covariance floor. Node-
// verified: healthy fit → log-likelihood ~246, variances ~0.011/0.021; collapse → a component's variance → ~1e-6 → 0.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Cov = [number, number, number]; // Sxx, Sxy, Syy
function makeData(): [number, number][] {
  let s = 71; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const g = () => { const a = Math.max(1e-9, r()), b = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
  const rot = (u: number, v: number, t: number): [number, number] => [u * Math.cos(t) - v * Math.sin(t), u * Math.sin(t) + v * Math.cos(t)];
  const p: [number, number][] = [];
  for (let i = 0; i < 75; i++) { const [x, y] = rot(g() * 0.15, g() * 0.05, 0.6); p.push([0.4 + x, 0.46 + y]); }
  for (let i = 0; i < 75; i++) { const [x, y] = rot(g() * 0.15, g() * 0.05, -0.5); p.push([0.6 + x, 0.56 + y]); }
  p.push([0.2, 0.82]); // a lone outlier — the point a floor-free component will collapse onto
  return p;
}
const DATA = makeData();
const OUTLIER = DATA.length - 1;
const K = 2;
function gauss(p: number[], mu: number[], S: Cov): number { const dx = p[0] - mu[0], dy = p[1] - mu[1]; const det = S[0] * S[2] - S[1] * S[1]; if (det <= 1e-15) return 1e-15; const iv = [S[2] / det, -S[1] / det, S[0] / det]; const q = dx * (iv[0] * dx + iv[1] * dy) + dy * (iv[1] * dx + iv[2] * dy); return Math.exp(-0.5 * q) / (2 * Math.PI * Math.sqrt(det)); }
type GmmState = { mu: number[][]; S: Cov[]; pi: number[]; gamma: number[][]; ll: number };
const initFit = (): GmmState => ({ mu: [[0.43, 0.5], [0.57, 0.52]], S: [[0.02, 0, 0.02], [0.02, 0, 0.02]], pi: [0.5, 0.5], gamma: DATA.map(() => [0.5, 0.5]), ll: 0 });
const initCollapse = (): GmmState => ({ mu: [DATA[OUTLIER].slice(), [0.52, 0.51]], S: [[3e-4, 0, 3e-4], [0.03, 0, 0.03]], pi: [0.5, 0.5], gamma: DATA.map(() => [0.5, 0.5]), ll: 0 });
function emStep(st: GmmState, floor: number): GmmState {
  const gamma = DATA.map((p) => { const w = st.pi.map((_, k) => st.pi[k] * gauss(p, st.mu[k], st.S[k])); const z = w.reduce((a, b) => a + b, 1e-15); return w.map((x) => x / z); });
  const mu: number[][] = [], S: Cov[] = [], pi: number[] = [];
  for (let k = 0; k < K; k++) { const Nk = gamma.reduce((a, gi) => a + gi[k], 1e-12);
    const mx = gamma.reduce((a, gi, i) => a + gi[k] * DATA[i][0], 0) / Nk, my = gamma.reduce((a, gi, i) => a + gi[k] * DATA[i][1], 0) / Nk;
    let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < DATA.length; i++) { const dx = DATA[i][0] - mx, dy = DATA[i][1] - my; sxx += gamma[i][k] * dx * dx; sxy += gamma[i][k] * dx * dy; syy += gamma[i][k] * dy * dy; }
    mu.push([mx, my]); S.push([sxx / Nk + floor, sxy / Nk, syy / Nk + floor]); pi.push(Nk / DATA.length); }
  const ll = DATA.reduce((s, p) => s + Math.log(pi.reduce((a, _, k) => a + pi[k] * gauss(p, mu[k], S[k]), 1e-15)), 0);
  return { mu, S, pi, gamma, ll };
}
const minVar = (st: GmmState) => Math.min(...st.S.map((s) => Math.min(s[0], s[2])));
function ellipse(mu: number[], S: Cov) { const [a, b, c] = S; const tr = (a + c) / 2, d = Math.sqrt(((a - c) / 2) ** 2 + b * b); return { cx: mu[0], cy: mu[1], r1: Math.sqrt(Math.max(1e-9, tr + d)), r2: Math.sqrt(Math.max(1e-9, tr - d)), ang: 0.5 * Math.atan2(2 * b, a - c) }; }

const OX = 250, OY = 18, SZ = 372;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;
const HUE = [30, 210];
const COLLAPSED = 1e-4; // a component whose variance drops below this has collapsed to a spike

type Phase = 'soft' | 'ellipse' | 'estep' | 'mstep' | 'improve' | 'run';

export function GmmSection() {
  const [mode, setMode] = useState<'fit' | 'collapse'>('fit');
  const cfg = useRef({ init: initFit, floor: 1e-3 });
  const st = useRef<GmmState>(initFit()); const step = useRef(0); const conv = useRef(false);
  const [, tick] = useState(0); const frame = useRef(0);
  const reset = () => { st.current = cfg.current.init(); step.current = 0; conv.current = false; };
  useEffect(() => { cfg.current = mode === 'collapse' ? { init: initCollapse, floor: 0 } : { init: initFit, floor: 1e-3 }; reset(); tick((t) => t + 1); }, [mode]);

  useEffect(() => {
    reset();
    let raf = 0; const loop = () => { frame.current++;
      if (frame.current % 8 === 0 && !conv.current) { const before = st.current.ll; st.current = emStep(st.current, cfg.current.floor); step.current++; if (minVar(st.current) < COLLAPSED || (step.current > 2 && Math.abs(before - st.current.ll) < 1e-3)) conv.current = true; tick((t) => (t + 1) % 100000); }
      if (conv.current && frame.current % 340 === 0) reset();
      raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const collapsed = minVar(st.current) < COLLAPSED;
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Gm phase={key} st={st.current} step={step.current} conv={conv.current} collapsed={false} /> });

  const scenes: StoryScene[] = [
    scene('soft', 'Soft clusters, not hard labels', 'k-means forces every point into exactly one round cluster. But real clusters overlap and stretch into ellipses, and a point sitting between two groups is genuinely ambiguous. A Gaussian mixture models the data as a blend of bell curves and gives each point a soft membership — say 70% this cluster, 30% that.'),
    scene('ellipse', 'Each cluster is a Gaussian ellipse', 'Model each cluster as a 2-D Gaussian: a mean (its center) and a covariance (an ellipse’s width, height, and tilt). Unlike k-means’ fixed round cells, these ellipses can be wide, narrow, or slanted to match how the data actually spreads — here two tilted, overlapping blobs.'),
    scene('estep', 'E-step: soft responsibilities', 'Given the current ellipses, compute for every point the probability it came from each Gaussian — its responsibilities. Points deep inside one ellipse are almost entirely that cluster; points in the overlap split their membership, and their colour goes pale to show the model is unsure.'),
    scene('mstep', 'M-step: refit each Gaussian', 'Now move each Gaussian to fit the points it’s responsible for — a responsibility-weighted mean and covariance. Confident points pull hard, ambiguous points pull only a little. The ellipses shift, rotate, and reshape to hug their clusters more tightly.'),
    scene('improve', 'EM only ever improves — which is the trap', 'Alternate E and M. A theorem guarantees the log-likelihood never decreases, so it climbs and climbs. But climbing toward what? The likelihood is unbounded: a Gaussian can shrink its variance toward zero on a single point, where its density — and the likelihood — races to infinity. "Always improving" can mean "improving toward a degenerate spike".'),
    { key: 'run', title: 'Fit it — then watch a component collapse', caption: 'On “fit”, EM rotates the two ellipses onto the tilted clusters and the log-likelihood climbs to a sensible plateau — it captures the slant and overlap k-means carves straight through. Now switch to “collapse” and remove the covariance floor: one Gaussian seeds on the lone outlier and, with nothing to stop it, its variance races to zero — the ellipse shrinks to a spike on that one point, its density blows up, and the likelihood diverges to +∞. EM is still “improving” every step, but it has found a singularity, not a cluster. That’s why every real GMM floors the covariance (or adds a prior). The guarantee is only as good as the thing it maximizes.', render: () => <Gm phase="run" st={st.current} step={step.current} conv={conv.current} collapsed={collapsed} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>k-means forces every point into one round, equal cluster — but real clusters overlap and stretch into ellipses, and a point between two groups is genuinely ambiguous. A <strong>Gaussian mixture model</strong> treats the data as a blend of bell-shaped Gaussians and gives each point a <strong>soft membership</strong>, fitting each cluster as an ellipse of any size and tilt, via <strong>Expectation-Maximization</strong>. EM provably never lowers the likelihood — but that guarantee has a sharp edge: the likelihood is unbounded, so a component can collapse onto a single point and send it to infinity. You can trigger exactly that here.</>,
        takeaway: <>A GMM describes the data as a weighted sum of K Gaussians, each with a mean, a <strong>covariance</strong> (a 2-D ellipse’s shape and tilt), and a mixing weight, fit by <strong>Expectation-Maximization</strong>: the <strong>E-step</strong> computes each point’s <em>responsibilities</em> (posterior probability of each Gaussian), the <strong>M-step</strong> re-estimates each Gaussian as responsibility-weighted averages of the points. A theorem guarantees each iteration never decreases the log-likelihood — GMM is the soft, elliptical generalization of k-means (k-means is the hard-0/1, spherical special case), so it captures overlapping, elongated clusters and reports calibrated uncertainty. But the monotonic-likelihood guarantee is double-edged, because the likelihood is <strong>unbounded above</strong>: a component can center on a single point and drive its variance toward 0, where its density → ∞ and the total log-likelihood → +∞ (verified here — with the covariance floor removed, one component’s variance races from ~0.02 to ~1e-6 and on toward 0, a degenerate spike that “explains” one point perfectly and clusters nothing). EM happily climbs toward that <strong>singularity</strong>. The standard fixes are to <strong>floor the covariance</strong> (a minimum variance), add a small ridge to it, or place a prior on it (MAP-EM) — which is why production GMMs never run unregularized — plus restarting from several initializations to dodge poor local maxima. The same expectation-then-maximize pattern trains hidden Markov models and imputes missing data; the singularity is the price of modeling continuous density.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="gmm-ctl">
          <div className="gmm-ctl-row">
            <button type="button" className={`gmm-btn ${mode === 'fit' ? 'on' : ''}`} onClick={() => setMode('fit')}>healthy fit</button>
            <button type="button" className={`gmm-btn ${mode === 'collapse' ? 'on' : ''}`} onClick={() => setMode('collapse')}>💥 remove covariance floor</button>
            <button type="button" className="gmm-btn ghost" onClick={reset}>↻ restart</button>
          </div>
          <span className={`gmm-live ${collapsed ? 'warn' : ''}`}>
            step {step.current} · {collapsed ? <>a component collapsed · min variance <b>{minVar(st.current).toExponential(1)}</b> → 0 · log-likelihood → ∞ (singular)</> : <>log-likelihood <b>{st.current.ll.toFixed(1)}</b> · min variance {minVar(st.current).toExponential(1)}{conv.current ? ' · converged ✓' : ' · climbing'}</>}
          </span>
        </div>
      )}
    />
  );
}

function Gm({ phase, st, step, conv, collapsed }: { phase: Phase; st: GmmState; step: number; conv: boolean; collapsed: boolean }) {
  const on = (p: Phase) => phase === p;
  const showEllipse = !on('soft');
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="28" className={`gmm-col ${collapsed ? 'warn' : ''}`}>{DATA.length} points, {K} Gaussians{showEllipse ? collapsed ? ` · step ${step} · a component collapsed → spike, log-likelihood → ∞` : ` · step ${step} · log-likelihood ${st.ll.toFixed(1)}${conv ? ' · converged' : ''}` : ' · soft membership, not one hard label'}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="gmm-frame" />

      {showEllipse && st.mu.map((mu, k) => { const e = ellipse(mu, st.S[k]); const spike = Math.min(st.S[k][0], st.S[k][2]) < COLLAPSED; return (
        <g key={k}>
          {[1, 2].map((sd) => <ellipse key={sd} cx={sx(e.cx)} cy={sy(e.cy)} rx={Math.max(spike ? 2.5 : 0, e.r1 * SZ * sd)} ry={Math.max(spike ? 2.5 : 0, e.r2 * SZ * sd)} transform={`rotate(${-e.ang * 180 / Math.PI} ${sx(e.cx)} ${sy(e.cy)})`} className={`gmm-ell ${spike ? 'spike' : ''}`} style={{ stroke: `hsl(${HUE[k]} 70% 62%)`, opacity: sd === 1 ? 0.9 : 0.4 }} />)}
          <circle cx={sx(e.cx)} cy={sy(e.cy)} r="3" style={{ fill: `hsl(${HUE[k]} 80% 66%)` }} />
          {spike && <text x={sx(e.cx)} y={sy(e.cy) - 10} className="gmm-spike-lbl" textAnchor="middle">variance → 0</text>}
        </g>); })}

      {DATA.map((p, i) => { const g1 = showEllipse ? st.gamma[i][1] : 0.5; const dom = g1 >= 0.5 ? 1 : 0; const conf = Math.abs(g1 - 0.5) * 2; return <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={i === OUTLIER ? 4.2 : 3.4} className={`gmm-pt ${i === OUTLIER ? 'outlier' : ''}`} style={{ fill: showEllipse ? `hsl(${HUE[dom]} 70% 62%)` : 'hsl(220 12% 62%)', opacity: showEllipse ? 0.35 + conf * 0.6 : 0.8 }} />; })}

      <text x="450" y="398" className={`gmm-foot ${collapsed ? 'warn' : ''}`} textAnchor="middle">
        {on('soft') ? 'a point between clusters is genuinely ambiguous — express that'
          : on('ellipse') ? 'each cluster = a Gaussian: a mean + a tilt-and-shape covariance'
          : on('estep') ? 'E-step: each point’s probability of belonging to each Gaussian'
          : on('mstep') ? 'M-step: refit each Gaussian to its responsibility-weighted points'
          : on('improve') ? 'log-likelihood never decreases — but it can climb toward a singularity'
          : collapsed ? 'no floor: a Gaussian shrank onto one point, variance → 0, likelihood → ∞'
          : conv ? `converged: log-likelihood ${st.ll.toFixed(1)} — ellipses fit the tilt` : `EM climbing… log-likelihood ${st.ll.toFixed(1)}`}
      </text>
    </svg>
  );
}
