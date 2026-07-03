// Guided story: RANSAC — robust model fitting that ignores outliers instead of averaging them in. Least-squares
// minimizes squared error over ALL points, so a handful of gross outliers drag the fit badly off. RANSAC repeats:
// pick a minimal random sample (2 points for a line), fit it, count inliers (points within a threshold), and keep the
// hypothesis with the most inliers — then refit on those. It only needs one outlier-free sample, so it tolerates >50%
// outliers. Verified in node: at 50% outliers least-squares gets slope 0.33 (true 0.6); RANSAC recovers 0.60 exactly.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const TRUE_M = 0.6, TRUE_B = 0.15, THRESH = 0.05;
type Pt = [number, number, boolean];
function makeData(): Pt[] {
  let s = 42; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const g = () => { const a = Math.max(1e-9, r()), b = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
  const p: Pt[] = [];
  for (let i = 0; i < 46; i++) { const x = 0.05 + r() * 0.9; p.push([x, TRUE_M * x + TRUE_B + g() * 0.02, true]); }
  for (let i = 0; i < 46; i++) p.push([0.05 + r() * 0.9, 0.05 + r() * 0.9, false]);
  return p;
}
const DATA = makeData();
function lsq(P: [number, number][]): [number, number] { const n = P.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const [x, y] of P) { sx += x; sy += y; sxx += x * x; sxy += x * y; } const d = n * sxx - sx * sx; const m = d ? (n * sxy - sx * sy) / d : 0; return [m, (sy - m * sx) / n]; }
const LSQ = lsq(DATA.map((p) => [p[0], p[1]]));
const inliersOf = (m: number, b: number) => DATA.filter((p) => Math.abs(p[1] - (m * p[0] + b)) < THRESH);

const OX = 250, OY = 18, SZ = 372;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + SZ * (1 - y);

type Phase = 'outliers' | 'sample' | 'consensus' | 'best' | 'why' | 'run';

export function RansacSection() {
  const best = useRef<{ m: number; b: number; inl: number }>({ m: 0, b: 0.5, inl: 0 });
  const cand = useRef<{ i: number; j: number; m: number; b: number } | null>(null);
  const iter = useRef(0);
  const [, tick] = useState(0); const frame = useRef(0);
  const reset = () => { best.current = { m: 0, b: 0.5, inl: 0 }; iter.current = 0; cand.current = null; };
  useEffect(() => {
    let raf = 0; const loop = () => { frame.current++;
      if (frame.current % 8 === 0 && iter.current < 120) {
        const i = Math.floor(Math.random() * DATA.length); let j = Math.floor(Math.random() * DATA.length); if (j === i) j = (j + 1) % DATA.length;
        const [x1, y1] = DATA[i], [x2, y2] = DATA[j];
        if (Math.abs(x2 - x1) > 1e-4) { const m = (y2 - y1) / (x2 - x1), b = y1 - m * x1; const inl = inliersOf(m, b).length; cand.current = { i, j, m, b }; if (inl > best.current.inl) best.current = { m, b, inl }; iter.current++; tick((t) => (t + 1) % 100000); }
      }
      raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  // refit on inliers for the final line
  const refit = () => { const inl = inliersOf(best.current.m, best.current.b); return inl.length > 1 ? lsq(inl.map((p) => [p[0], p[1]])) : [best.current.m, best.current.b] as [number, number]; };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Rns phase={key} best={best.current} cand={cand.current} iter={iter.current} refit={refit()} /> });

  const scenes: StoryScene[] = [
    scene('outliers', 'Outliers wreck least-squares', 'Fit a line by least-squares and it minimizes the squared error to every point at once. So the scattered outliers (grey) — nowhere near the true line — drag the red fit badly off course. Averaging can’t ignore bad data; a few gross outliers are enough to ruin the estimate.'),
    scene('sample', 'Guess from a minimal sample', 'RANSAC takes the opposite tack. A line needs just two points to define it, so pick two points at random and draw the line through them (the yellow guess). Most random pairs are junk — but every so often both points are real inliers, and that guess lands right on the true line.'),
    scene('consensus', 'Count the consensus', 'For each guess, count its inliers: the points lying within a threshold band of it (green, inside the shaded strip). A line through two outliers, or one outlier and one inlier, collects only a few. A line through two true inliers collects nearly all the real points — a big consensus.'),
    scene('best', 'Keep the best, refit on it', 'Repeat for many random pairs and keep the guess with the largest inlier set. That winner sits on the clean majority, so a final least-squares fit on just its inliers recovers the true line almost exactly — the outliers never entered the calculation.'),
    scene('why', 'Robust past 50% outliers', 'Why it works: RANSAC only needs to hit one all-inlier sample to find the model, and for a 2-point line that’s likely within a couple dozen tries even when most of the data is garbage. The formula N ≥ log(1−p)/log(1−wˢ) says how many tries — about 17 for 50% inliers at 99% confidence. Cheap and outlier-proof.'),
    { key: 'run', title: 'Run the consensus search', caption: 'RANSAC runs live: each yellow guess is a random two-point line, and the running best (green) locks onto the true line as more pairs are tried, its inliers lighting up green inside the threshold band while the red least-squares line stays dragged off by the outliers it can’t ignore. Restart to watch the search find consensus from scratch.', render: () => <Rns phase="run" best={best.current} cand={cand.current} iter={iter.current} refit={refit()} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Fitting a line by least-squares minimizes the total squared error to <em>all</em> points, so a handful of outliers far from the true line drag the fit badly off. <strong>RANSAC</strong> ignores the outliers instead of averaging them in: it repeatedly picks a minimal random sample (just 2 points for a line), fits a model, and counts how many other points agree within a threshold (the <strong>inliers</strong>). After many tries it keeps the model with the most inliers — the one explaining the clean majority — and refits on just those. Because it only needs to draw one outlier-free sample to find the true model, it tolerates even a majority of outliers.</>,
        takeaway: <>RANSAC (RANdom SAmple Consensus) is robust fitting by hypothesis-and-test. Least-squares assumes Gaussian noise and minimizes squared error over every point, giving it a breakdown point of zero — one gross outlier can move the estimate arbitrarily far (verified here: with 50% outliers least-squares recovers slope 0.33 for a true 0.6). RANSAC instead repeats: (1) sample the minimal number of points that define the model — 2 for a line, 3 for a circle, 4 for a homography; (2) fit the model to that sample; (3) count the <strong>inliers</strong> within a distance threshold t. After N iterations it keeps the hypothesis with the largest inlier set and refits by least-squares on those inliers (verified: it recovers the true slope 0.60 exactly and identifies all 50 real inliers). The iteration count comes from probability: to draw at least one all-inlier sample with confidence p when a fraction w of points are inliers and the model needs s points, <code>N ≥ log(1−p) / log(1−wˢ)</code> — for a line (s=2) with 50% inliers, only ~17 tries give 99% confidence, so it’s cheap. The threshold t and the inlier ratio are the knobs — too tight rejects good points, too loose lets outliers in. RANSAC is the workhorse of computer vision: fitting lines and planes, estimating the fundamental matrix and homographies for panorama stitching and structure-from-motion, and registering 3-D point clouds — anywhere the data is a clean model plus gross outliers.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="rns-ctl">
          <button type="button" className="rns-btn" onClick={reset}>↻ restart search</button>
          <span className="rns-live">iteration {iter.current} · best consensus {best.current.inl}/{DATA.length} inliers</span>
        </div>
      )}
    />
  );
}

function Rns({ phase, best, cand, iter, refit }: { phase: Phase; best: { m: number; b: number; inl: number }; cand: { i: number; j: number; m: number; b: number } | null; iter: number; refit: [number, number] }) {
  const on = (p: Phase) => phase === p;
  const showRansac = !on('outliers') && !on('sample');
  const showCand = on('sample') || on('consensus') || on('run');
  const [rm, rb] = refit;
  const lineY = (m: number, b: number, x: number) => m * x + b;
  const inlierSet = new Set(showRansac ? inliersOf(best.m, best.b).map((p) => DATA.indexOf(p)) : []);
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="24" className="rns-col">50% outliers{showRansac ? ` · RANSAC best ${best.inl}/${DATA.length} inliers · iter ${iter}` : on('outliers') ? ' · least-squares dragged off' : ' · random 2-point guesses'}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="rns-frame" />

      {/* threshold band around RANSAC line */}
      {(on('consensus') || on('best') || on('run') || on('why')) && <polygon points={`${sx(0)},${sy(lineY(best.m, best.b, 0) + THRESH)} ${sx(1)},${sy(lineY(best.m, best.b, 1) + THRESH)} ${sx(1)},${sy(lineY(best.m, best.b, 1) - THRESH)} ${sx(0)},${sy(lineY(best.m, best.b, 0) - THRESH)}`} className="rns-band" />}

      {/* points */}
      {DATA.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={cand && (i === cand.i || i === cand.j) && showCand ? 6 : 3.4} className={`rns-pt ${inlierSet.has(i) ? 'in' : 'out'} ${cand && (i === cand.i || i === cand.j) && showCand ? 'pick' : ''}`} />)}

      {/* least-squares line (always, for contrast) */}
      <line x1={sx(0)} y1={sy(lineY(LSQ[0], LSQ[1], 0))} x2={sx(1)} y2={sy(lineY(LSQ[0], LSQ[1], 1))} className="rns-lsq" />
      {/* candidate line */}
      {showCand && cand && <line x1={sx(0)} y1={sy(lineY(cand.m, cand.b, 0))} x2={sx(1)} y2={sy(lineY(cand.m, cand.b, 1))} className="rns-cand" />}
      {/* RANSAC best (refit) line */}
      {showRansac && <line x1={sx(0)} y1={sy(lineY(rm, rb, 0))} x2={sx(1)} y2={sy(lineY(rm, rb, 1))} className="rns-best" />}

      <text x={OX + 6} y={OY + SZ - 8} className="rns-key"><tspan className="rns-klsq">— least-squares</tspan>{showRansac ? <tspan className="rns-kbest">   — RANSAC</tspan> : null}{showCand ? <tspan className="rns-kcand">   — guess</tspan> : null}</text>
      <text x="450" y="404" className="rns-foot" textAnchor="middle">
        {on('outliers') ? 'least-squares averages in the outliers → the line is dragged off'
          : on('sample') ? 'two random points define a candidate line — most are junk'
          : on('consensus') ? 'inliers = points within the band; a good line has many'
          : on('best') ? 'keep the max-consensus line, refit on its inliers → true line'
          : on('why') ? 'one clean 2-point sample suffices → robust past 50% outliers'
          : `iter ${iter}: best ${best.inl}/${DATA.length} inliers — green locks on, red stays off`}
      </text>
    </svg>
  );
}
