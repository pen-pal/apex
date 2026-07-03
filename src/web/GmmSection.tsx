// Guided story: Gaussian mixture models via EM — soft, elliptical clustering that generalizes k-means. Model the data
// as a blend of K Gaussians (mean + covariance ellipse + weight); fit by Expectation-Maximization: E-step computes
// each point's soft responsibilities (posterior prob of each Gaussian), M-step refits each Gaussian to its
// responsibility-weighted points. A theorem guarantees the log-likelihood never decreases (verified in node: climbs
// ≈213→254 monotonically). Captures tilted overlapping clusters + ambiguity that k-means' hard round cells can't. Live.
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
  return p;
}
const DATA = makeData();
const K = 2;
function gauss(p: number[], mu: number[], S: Cov): number { const dx = p[0] - mu[0], dy = p[1] - mu[1]; const det = S[0] * S[2] - S[1] * S[1]; if (det <= 1e-12) return 1e-12; const iv = [S[2] / det, -S[1] / det, S[0] / det]; const q = dx * (iv[0] * dx + iv[1] * dy) + dy * (iv[1] * dx + iv[2] * dy); return Math.exp(-0.5 * q) / (2 * Math.PI * Math.sqrt(det)); }
type GmmState = { mu: number[][]; S: Cov[]; pi: number[]; gamma: number[][]; ll: number };
function initState(): GmmState { return { mu: [[0.43, 0.5], [0.57, 0.52]], S: [[0.02, 0, 0.02], [0.02, 0, 0.02]], pi: [0.5, 0.5], gamma: DATA.map(() => [0.5, 0.5]), ll: 0 }; }
function emStep(st: GmmState): GmmState {
  const gamma = DATA.map((p) => { const w = st.pi.map((_, k) => st.pi[k] * gauss(p, st.mu[k], st.S[k])); const z = w.reduce((a, b) => a + b, 1e-12); return w.map((x) => x / z); });
  const mu: number[][] = [], S: Cov[] = [], pi: number[] = [];
  for (let k = 0; k < K; k++) { const Nk = gamma.reduce((a, gi) => a + gi[k], 1e-12);
    const mx = gamma.reduce((a, gi, i) => a + gi[k] * DATA[i][0], 0) / Nk, my = gamma.reduce((a, gi, i) => a + gi[k] * DATA[i][1], 0) / Nk;
    let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < DATA.length; i++) { const dx = DATA[i][0] - mx, dy = DATA[i][1] - my; sxx += gamma[i][k] * dx * dx; sxy += gamma[i][k] * dx * dy; syy += gamma[i][k] * dy * dy; }
    mu.push([mx, my]); S.push([sxx / Nk + 1e-6, sxy / Nk, syy / Nk + 1e-6]); pi.push(Nk / DATA.length); }
  const ll = DATA.reduce((s, p) => s + Math.log(pi.reduce((a, _, k) => a + pi[k] * gauss(p, mu[k], S[k]), 1e-12)), 0);
  return { mu, S, pi, gamma, ll };
}
function ellipse(mu: number[], S: Cov) { const [a, b, c] = S; const tr = (a + c) / 2, d = Math.sqrt(((a - c) / 2) ** 2 + b * b); return { cx: mu[0], cy: mu[1], r1: Math.sqrt(tr + d), r2: Math.sqrt(Math.max(1e-9, tr - d)), ang: 0.5 * Math.atan2(2 * b, a - c) }; }

const OX = 250, OY = 18, SZ = 372;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;
const HUE = [30, 210];

type Phase = 'soft' | 'ellipse' | 'estep' | 'mstep' | 'improve' | 'run';

export function GmmSection() {
  const st = useRef<GmmState>(initState()); const step = useRef(0); const conv = useRef(false);
  const [, tick] = useState(0); const frame = useRef(0);
  const reset = () => { st.current = initState(); step.current = 0; conv.current = false; };
  useEffect(() => {
    let raf = 0; const loop = () => { frame.current++;
      if (frame.current % 8 === 0 && !conv.current) { const before = st.current.ll; st.current = emStep(st.current); step.current++; if (step.current > 2 && Math.abs(before - st.current.ll) < 1e-3) conv.current = true; tick((t) => (t + 1) % 100000); }
      if (conv.current && frame.current % 320 === 0) reset();
      raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Gm phase={key} st={st.current} step={step.current} conv={conv.current} /> });

  const scenes: StoryScene[] = [
    scene('soft', 'Soft clusters, not hard labels', 'k-means forces every point into exactly one round cluster. But real clusters overlap and stretch into ellipses, and a point sitting between two groups is genuinely ambiguous. A Gaussian mixture models the data as a blend of bell curves and gives each point a soft membership — say 70% this cluster, 30% that.'),
    scene('ellipse', 'Each cluster is a Gaussian ellipse', 'Model each cluster as a 2-D Gaussian: a mean (its center) and a covariance (an ellipse’s width, height, and tilt). Unlike k-means’ fixed round cells, these ellipses can be wide, narrow, or slanted to match how the data actually spreads — here two tilted, overlapping blobs.'),
    scene('estep', 'E-step: soft responsibilities', 'Given the current ellipses, compute for every point the probability it came from each Gaussian — its responsibilities. Points deep inside one ellipse are almost entirely that cluster; points in the overlap split their membership, and their colour goes pale to show the model is unsure.'),
    scene('mstep', 'M-step: refit each Gaussian', 'Now move each Gaussian to fit the points it’s responsible for — a responsibility-weighted mean and covariance. Confident points pull hard, ambiguous points pull only a little. The ellipses shift, rotate, and reshape to hug their clusters more tightly.'),
    scene('improve', 'EM only ever improves the fit', 'Alternate E and M. A theorem guarantees the data’s log-likelihood never decreases — every round explains the data at least as well as the last — so it climbs to a maximum and stops. k-means is exactly this algorithm with hard 0/1 memberships and identical round covariances.'),
    { key: 'run', title: 'Run EM', caption: 'Expectation-Maximization runs live: the two ellipses rotate and stretch onto the tilted clusters, the point colours settle (vivid where a point clearly belongs, pale in the ambiguous overlap), and the log-likelihood climbs monotonically to a plateau. It fits the slanted, overlapping shapes k-means would carve straight through — and it tells you which points are uncertain.', render: () => <Gm phase="run" st={st.current} step={step.current} conv={conv.current} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>k-means forces every point into exactly one round, equal-sized cluster — but real clusters overlap and stretch into ellipses, and a point between two groups is genuinely ambiguous. A <strong>Gaussian mixture model</strong> treats the data as a blend of bell-shaped Gaussians and gives each point a <strong>soft membership</strong> (70% this cluster, 30% that), fitting each cluster as an ellipse of any size and tilt. It’s trained by <strong>Expectation-Maximization</strong>, which provably improves the fit every step.</>,
        takeaway: <>A Gaussian mixture model (GMM) describes the data as a weighted sum of K Gaussians, each with a mean, a <strong>covariance</strong> (a 2-D ellipse’s shape and orientation), and a mixing weight. It’s fit by <strong>Expectation-Maximization</strong>, alternating two steps: the <strong>E-step</strong> computes each point’s <em>responsibilities</em> — the posterior probability it was generated by each Gaussian, given the current parameters — and the <strong>M-step</strong> re-estimates each Gaussian’s mean, covariance, and weight as responsibility-weighted averages of the points. A foundational theorem guarantees each EM iteration never decreases the data’s log-likelihood (verified here: it climbs monotonically to a plateau), so EM converges to a local maximum. GMM is the soft, elliptical generalization of k-means — in fact k-means is the special case with hard 0/1 responsibilities and identical spherical covariances — so it captures overlapping, elongated, differently-sized clusters that k-means mis-splits, and reports calibrated uncertainty for ambiguous points instead of a hard label. The same expectation-then-maximize pattern (fill in hidden variables in expectation, then maximize) underlies hidden Markov model training, missing-data imputation, and many latent-variable models; the costs are choosing K and the risk of a poor local optimum, so EM is usually run from several initializations or seeded with k-means.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="gmm-ctl">
          <button type="button" className="gmm-btn" onClick={reset}>↻ restart EM</button>
          <span className="gmm-live">step {step.current} · log-likelihood {st.current.ll.toFixed(1)}{conv.current ? ' · converged ✓' : ' · climbing'}</span>
        </div>
      )}
    />
  );
}

function Gm({ phase, st, step, conv }: { phase: Phase; st: GmmState; step: number; conv: boolean }) {
  const on = (p: Phase) => phase === p;
  const showEllipse = !on('soft');
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="28" className="gmm-col">{DATA.length} points, {K} Gaussians{showEllipse ? ` · step ${step} · log-likelihood ${st.ll.toFixed(1)}${conv ? ' · converged' : ''}` : ' · soft membership, not one hard label'}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="gmm-frame" />

      {/* Gaussian ellipses */}
      {showEllipse && st.mu.map((mu, k) => { const e = ellipse(mu, st.S[k]); return (
        <g key={k}>
          {[1, 2].map((sd) => <ellipse key={sd} cx={sx(e.cx)} cy={sy(e.cy)} rx={e.r1 * SZ * sd} ry={e.r2 * SZ * sd} transform={`rotate(${-e.ang * 180 / Math.PI} ${sx(e.cx)} ${sy(e.cy)})`} className="gmm-ell" style={{ stroke: `hsl(${HUE[k]} 70% 62%)`, opacity: sd === 1 ? 0.9 : 0.4 }} />)}
          <circle cx={sx(e.cx)} cy={sy(e.cy)} r="3" style={{ fill: `hsl(${HUE[k]} 80% 66%)` }} />
        </g>); })}

      {/* points coloured by responsibility (vivid = confident, pale = ambiguous) */}
      {DATA.map((p, i) => { const g1 = showEllipse ? st.gamma[i][1] : 0.5; const dom = g1 >= 0.5 ? 1 : 0; const conf = Math.abs(g1 - 0.5) * 2; return <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3.4" className="gmm-pt" style={{ fill: showEllipse ? `hsl(${HUE[dom]} 70% 62%)` : 'hsl(220 12% 62%)', opacity: showEllipse ? 0.35 + conf * 0.6 : 0.8 }} />; })}

      <text x="450" y="398" className="gmm-foot" textAnchor="middle">
        {on('soft') ? 'a point between clusters is genuinely ambiguous — express that'
          : on('ellipse') ? 'each cluster = a Gaussian: a mean + a tilt-and-shape covariance'
          : on('estep') ? 'E-step: each point’s probability of belonging to each Gaussian'
          : on('mstep') ? 'M-step: refit each Gaussian to its responsibility-weighted points'
          : on('improve') ? 'log-likelihood never decreases → EM climbs to a maximum'
          : conv ? `converged: log-likelihood ${st.ll.toFixed(1)} — ellipses fit the tilt` : `EM climbing… log-likelihood ${st.ll.toFixed(1)}`}
      </text>
    </svg>
  );
}
