// Guided story: RANSAC — robust model fitting that ignores outliers instead of averaging them in. Least-squares
// minimizes squared error over ALL points, so a handful of gross outliers drag the fit badly off. RANSAC repeats:
// pick a minimal random sample (2 points for a line), fit it, count inliers (points within a threshold), and keep the
// hypothesis with the most inliers, then refit on those. DEEPENED so you PRODUCE and BREAK it:
//  · a slider sets the outlier %. Crank it and least-squares' slope drifts off (0.43 → 0.11) while RANSAC holds at
//    ~0.60 — but the tries it needs to be sure explode (5 → 203), so robustness isn't free.
//  · a "decoy line" toggle plants a SECOND, larger line. RANSAC finds the biggest consensus — so it locks onto the
//    decoy (slope −0.32) and ignores the true line entirely. RANSAC finds the MAJORITY structure, not the truth.
// Node-verified: scattered 20/50/70/85% → LS 0.43/0.34/0.18/0.11, RANSAC ~0.60; decoy → RANSAC −0.32 (wrong).
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const TRUE_M = 0.6, TRUE_B = 0.15, THRESH = 0.05;
type Pt = [number, number];
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); }; }
const gauss = (r: () => number) => { const a = Math.max(1e-9, r()), b = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
function scattered(frac: number): Pt[] {
  const r = rng(42); const N = 92; const nin = Math.round((1 - frac) * N); const p: Pt[] = [];
  for (let i = 0; i < nin; i++) { const x = 0.05 + r() * 0.9; p.push([x, TRUE_M * x + TRUE_B + gauss(r) * 0.02]); }
  for (let i = 0; i < N - nin; i++) p.push([0.05 + r() * 0.9, 0.05 + r() * 0.9]);
  return p;
}
function decoyData(): Pt[] {
  const r = rng(7); const p: Pt[] = [];
  for (let i = 0; i < 30; i++) { const x = 0.05 + r() * 0.9; p.push([x, TRUE_M * x + TRUE_B + gauss(r) * 0.02]); }   // true line: 30
  for (let i = 0; i < 52; i++) { const x = 0.05 + r() * 0.9; p.push([x, -0.35 * x + 0.8 + gauss(r) * 0.02]); }        // decoy line: 52 (the majority)
  for (let i = 0; i < 10; i++) p.push([0.05 + r() * 0.9, 0.05 + r() * 0.9]);                                          // scatter
  return p;
}
function lsq(P: Pt[]): [number, number] { const n = P.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const [x, y] of P) { sx += x; sy += y; sxx += x * x; sxy += x * y; } const d = n * sxx - sx * sx; const m = d ? (n * sxy - sx * sy) / d : 0; return [m, (sy - m * sx) / n]; }
const inliersOf = (D: Pt[], m: number, b: number) => D.filter(([x, y]) => Math.abs(y - (m * x + b)) < THRESH);
// exhaustive max-consensus (deterministic): the 2-point line with the most inliers, refit on them
function ransacFit(D: Pt[]): { m: number; b: number; inl: number } {
  let bm = 0, bb = 0, bn = -1;
  for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) {
    const [x1, y1] = D[i], [x2, y2] = D[j]; if (Math.abs(x2 - x1) < 1e-4) continue;
    const m = (y2 - y1) / (x2 - x1), b = y1 - m * x1; const c = inliersOf(D, m, b).length;
    if (c > bn) { bn = c; bm = m; bb = b; }
  }
  const I = inliersOf(D, bm, bb); const [rm, rb] = I.length > 1 ? lsq(I) : [bm, bb];
  return { m: rm, b: rb, inl: bn };
}
const N99 = (w: number) => Math.ceil(Math.log(1 - 0.99) / Math.log(1 - w * w));

const OX = 250, OY = 18, SZ = 372;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + SZ * (1 - y);
type Phase = 'outliers' | 'sample' | 'consensus' | 'best' | 'why' | 'run';

export function RansacSection() {
  const [frac, setFrac] = useState(0.5);
  const [decoy, setDecoy] = useState(false);
  const DATA = useMemo(() => decoy ? decoyData() : scattered(frac), [frac, decoy]);
  const LSQ = useMemo(() => lsq(DATA), [DATA]);
  const RAN = useMemo(() => ransacFit(DATA), [DATA]);
  const view = { DATA, LSQ, RAN, frac, decoy };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Rns phase={key} v={view} /> });

  const scenes: StoryScene[] = [
    scene('outliers', 'Outliers wreck least-squares', 'Fit a line by least-squares and it minimizes the squared error to every point at once. So the scattered outliers (grey) — nowhere near the true line — drag the red fit badly off course. Averaging can’t ignore bad data; a few gross outliers are enough to ruin the estimate.'),
    scene('sample', 'Guess from a minimal sample', 'RANSAC takes the opposite tack. A line needs just two points to define it, so pick two points at random. Most random pairs are junk — but every so often both are real inliers, and that guess lands right on the true line.'),
    scene('consensus', 'Count the consensus', 'For each guess, count its inliers: points lying within a threshold band of it (green, inside the shaded strip). A line through two outliers collects a few; a line through two true inliers collects nearly all the real points — a big consensus.'),
    scene('best', 'Keep the best, refit on it', 'Repeat for many pairs and keep the guess with the largest inlier set (the green RANSAC line). It sits on the clean majority, so a final least-squares fit on just its inliers recovers the true line almost exactly — the outliers never entered the calculation.'),
    scene('why', 'Robust past 50% outliers', 'It only needs to hit one all-inlier sample to find the model, and for a 2-point line that’s likely within a couple dozen tries even when most data is garbage: N ≥ log(1−p)/log(1−wˢ) — about 17 tries for 50% inliers at 99% confidence.'),
    { key: 'run', title: 'Crank the outliers — then decoy it', caption: 'Drag the outlier fraction up. The red least-squares line swings further and further off as outliers dominate, but the green RANSAC line stays locked on the true slope ~0.6 — even past 80% garbage. Watch the “tries needed” climb, though: robustness costs exponentially more samples. Then flip on the decoy line, a second, LARGER cluster on a different slope. RANSAC keeps the biggest consensus — so it confidently fits the DECOY and ignores the true line. RANSAC finds the majority structure, not the truth.', render: () => <Rns phase="run" v={view} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Fitting a line by least-squares minimizes the total squared error to <em>all</em> points, so a handful of outliers far from the true line drag the fit badly off. <strong>RANSAC</strong> ignores outliers instead of averaging them in: it repeatedly picks a minimal random sample (2 points for a line), fits a model, and counts how many other points agree within a threshold (the <strong>inliers</strong>), keeping the model with the most. Because it only needs to draw one outlier-free sample, it tolerates even a majority of outliers — but only if the true line is the <em>largest</em> structure present.</>,
        takeaway: <>RANSAC (RANdom SAmple Consensus) is robust fitting by hypothesis-and-test. Least-squares assumes Gaussian noise and minimizes squared error over every point, giving it a breakdown point of zero — one gross outlier can move the estimate arbitrarily far (produce it here: dragging outliers to 50% pulls least-squares from slope 0.6 down to ~0.34, and to 85% down to ~0.11). RANSAC instead repeats: (1) sample the minimal points that define the model — 2 for a line, 3 for a circle, 4 for a homography; (2) fit; (3) count <strong>inliers</strong> within a distance threshold t; after N iterations keep the largest-inlier hypothesis and refit on it. The tries needed follow <code>N ≥ log(1−p) / log(1−wˢ)</code> — for a line with 50% inliers only ~17 give 99% confidence, but the count explodes as the inlier fraction w drops (≈203 at 15% inliers), so robustness is not free. And a sharper limit you can trigger: RANSAC keeps the <strong>largest</strong> consensus, which is not always the true one — plant a second, larger line (the decoy) and RANSAC confidently fits it and discards the real data. It finds the dominant structure, so it fails when a spurious structure outvotes the real one. RANSAC is nonetheless the workhorse of computer vision — fitting lines and planes, estimating fundamental matrices and homographies for panorama stitching and structure-from-motion, and registering 3-D point clouds — anywhere the data is one clean model plus gross outliers.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="rns-ctl">
          <div className="rns-ctl-row">
            <label className="rns-slider">outliers <input type="range" min={5} max={85} value={Math.round(frac * 100)} disabled={decoy} onChange={(e) => setFrac(+e.target.value / 100)} /><b>{decoy ? '—' : `${Math.round(frac * 100)}%`}</b></label>
            <button type="button" className={`rns-btn ${decoy ? 'on' : ''}`} onClick={() => setDecoy((d) => !d)}>🪤 decoy line</button>
          </div>
          <span className={`rns-live ${decoy || RAN.inl < 20 ? 'warn' : ''}`}>
            least-squares slope <b>{LSQ[0].toFixed(2)}</b> · RANSAC slope <b>{RAN.m.toFixed(2)}</b> (true 0.60){decoy ? '' : ` · tries needed for 99%: ${N99(1 - frac)}`}
            {decoy ? ' — RANSAC locked onto the bigger decoy line, not the true one' : Math.abs(RAN.m - 0.6) < 0.08 ? ' — RANSAC holds ✓, least-squares dragged off' : ''}
          </span>
        </div>
      )}
    />
  );
}

type View = { DATA: Pt[]; LSQ: [number, number]; RAN: { m: number; b: number; inl: number }; frac: number; decoy: boolean };
function Rns({ phase, v }: { phase: Phase; v: View }) {
  const on = (p: Phase) => phase === p;
  const { DATA, LSQ, RAN, frac, decoy } = v;
  const showRansac = !on('outliers') && !on('sample');
  const lineY = (m: number, b: number, x: number) => m * x + b;
  const inl = new Set(inliersOf(DATA, RAN.m, RAN.b).map((p) => DATA.indexOf(p)));
  const band = on('consensus') || on('best') || on('run') || on('why');
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="24" className="rns-col">{decoy ? 'a bigger decoy line planted' : `${Math.round(frac * 100)}% outliers`}{showRansac ? ` · RANSAC ${RAN.inl}/${DATA.length} inliers · slope ${RAN.m.toFixed(2)}` : on('outliers') ? ' · least-squares dragged off' : ''}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="rns-frame" />

      {/* true line for reference (faint dashed) */}
      <line x1={sx(0)} y1={sy(lineY(TRUE_M, TRUE_B, 0))} x2={sx(1)} y2={sy(lineY(TRUE_M, TRUE_B, 1))} className="rns-true" />

      {/* threshold band around the RANSAC line */}
      {band && showRansac && <polygon points={`${sx(0)},${sy(lineY(RAN.m, RAN.b, 0) + THRESH)} ${sx(1)},${sy(lineY(RAN.m, RAN.b, 1) + THRESH)} ${sx(1)},${sy(lineY(RAN.m, RAN.b, 1) - THRESH)} ${sx(0)},${sy(lineY(RAN.m, RAN.b, 0) - THRESH)}`} className="rns-band" />}

      {DATA.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3.4" className={`rns-pt ${showRansac && inl.has(i) ? 'in' : 'out'}`} />)}

      {/* least-squares line (red, dragged) */}
      <line x1={sx(0)} y1={sy(lineY(LSQ[0], LSQ[1], 0))} x2={sx(1)} y2={sy(lineY(LSQ[0], LSQ[1], 1))} className="rns-lsq" />
      {/* RANSAC best line (green) */}
      {showRansac && <line x1={sx(0)} y1={sy(lineY(RAN.m, RAN.b, 0))} x2={sx(1)} y2={sy(lineY(RAN.m, RAN.b, 1))} className={`rns-best ${decoy ? 'wrong' : ''}`} />}

      <text x={OX + 6} y={OY + SZ - 8} className="rns-key"><tspan className="rns-klsq">— least-squares</tspan>{showRansac ? <tspan className="rns-kbest">   — RANSAC</tspan> : null}<tspan className="rns-ktrue">   ·· true line</tspan></text>
      <text x="450" y="404" className={`rns-foot ${decoy ? 'warn' : ''}`} textAnchor="middle">
        {on('outliers') ? 'least-squares averages in the outliers → the line is dragged off'
          : on('sample') ? 'two random points define a candidate line — most are junk'
          : on('consensus') ? 'inliers = points within the band; a good line has many'
          : on('best') ? 'keep the max-consensus line, refit on its inliers → true line'
          : on('why') ? 'one clean 2-point sample suffices → robust past 50% outliers'
          : decoy ? 'the decoy is the bigger consensus → RANSAC fits it, ignoring the true line'
          : `${Math.round(frac * 100)}% outliers: red dragged to ${LSQ[0].toFixed(2)}, green holds at ${RAN.m.toFixed(2)}`}
      </text>
    </svg>
  );
}
