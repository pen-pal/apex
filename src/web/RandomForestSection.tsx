// Guided story: random forest — the ensemble that fixes a decision tree's overfitting. A single deep tree memorizes
// noise (jagged boundary, high test error). A forest trains many decorrelated trees — each on a bootstrap resample
// with a random feature subset per split — and votes. Their errors cancel: same low bias, far lower variance, a
// smooth boundary that generalizes. Verified in node: single deep tree 98% train / 72% test (overfit); forest ~76%
// test by 5+ trees. Bias-variance / wisdom of crowds. Interactive tree-count slider. Sandboxed/CONCEPTUAL.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Pt = [number, number, number];
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); }; }
function gen(n: number, r: () => number): Pt[] { const d: Pt[] = []; for (let i = 0; i < n; i++) { const x = r(), y = r(); let l = ((x - 0.5) ** 2 + (y - 0.5) ** 2) < 0.1 ? 1 : 0; if (r() < 0.12) l = 1 - l; d.push([x, y, l]); } return d; }
const gini = (p: Pt[]) => { const n = p.length; if (!n) return 0; let c = 0; for (const q of p) c += q[2]; const a = c / n; return 1 - a * a - (1 - a) ** 2; };
const maj = (p: Pt[]) => { let c = 0; for (const q of p) c += q[2]; return c * 2 >= p.length ? 1 : 0; };
type TNode = { leaf: 1; maj: number } | { leaf: 0; f: number; t: number; L: TNode; R: TNode };
function build(pts: Pt[], depth: number, maxD: number, rand: boolean, r: () => number): TNode {
  if (gini(pts) < 1e-9 || depth >= maxD || pts.length < 3) return { leaf: 1, maj: maj(pts) };
  const feats = rand ? [Math.floor(r() * 2)] : [0, 1]; let best: { f: number; t: number; wg: number; L: Pt[]; R: Pt[] } | null = null;
  for (const f of feats) { const vs = [...new Set(pts.map((p) => p[f]))].sort((a, b) => a - b); for (let i = 0; i < vs.length - 1; i++) { const t = (vs[i] + vs[i + 1]) / 2; const L = pts.filter((p) => p[f] <= t), R = pts.filter((p) => p[f] > t); if (!L.length || !R.length) continue; const wg = (L.length * gini(L) + R.length * gini(R)) / pts.length; if (!best || wg < best.wg) best = { f, t, wg, L, R }; } }
  if (!best) return { leaf: 1, maj: maj(pts) };
  return { leaf: 0, f: best.f, t: best.t, L: build(best.L, depth + 1, maxD, rand, r), R: build(best.R, depth + 1, maxD, rand, r) };
}
function pred(n: TNode, p: number[]): number { while (n.leaf === 0) n = p[n.f] <= n.t ? n.L : n.R; return n.maj; }

const G = 30, NMAX = 40;
// build everything once (fixed seed → deterministic)
const R = rng(101);
const TRAIN = gen(150, R), TEST = gen(500, R);
const SINGLE = build(TRAIN, 0, 12, false, R); // one full deep tree (overfits)
const TREES: TNode[] = []; for (let t = 0; t < NMAX; t++) { const boot = Array.from({ length: TRAIN.length }, () => TRAIN[Math.floor(R() * TRAIN.length)]); TREES.push(build(boot, 0, 12, true, R)); }
// cumulative grid votes + test votes over trees
const cellCum: Int16Array[] = []; const testCum: Int16Array[] = [];
{ const gc = new Int16Array(G * G), tc = new Int16Array(TEST.length);
  for (let n = 0; n < NMAX; n++) { for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) gc[i * G + j] += pred(TREES[n], [(i + 0.5) / G, (j + 0.5) / G]); for (let k = 0; k < TEST.length; k++) tc[k] += pred(TREES[n], TEST[k]); cellCum.push(gc.slice()); testCum.push(tc.slice()); } }
const singleCell = new Uint8Array(G * G); for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) singleCell[i * G + j] = pred(SINGLE, [(i + 0.5) / G, (j + 0.5) / G]);
const singleTestAcc = TEST.filter((p) => pred(SINGLE, p) === p[2]).length / TEST.length;
const singleTrainAcc = TRAIN.filter((p) => pred(SINGLE, p) === p[2]).length / TRAIN.length;
const forestTestAcc = (N: number) => TEST.filter((p, k) => (testCum[N - 1][k] * 2 >= N ? 1 : 0) === p[2]).length / TEST.length;

const OX = 250, OY = 18, SZ = 372;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;

type Phase = 'overfit' | 'bag' | 'vote' | 'cancel' | 'crowd' | 'run';

export function RandomForestSection() {
  const [nTrees, setN] = useState(24);
  const testAcc = useMemo(() => forestTestAcc(nTrees), [nTrees]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <RF phase={key} n={key === 'overfit' ? 1 : 30} testAcc={key === 'overfit' ? singleTestAcc : forestTestAcc(30)} /> });

  const scenes: StoryScene[] = [
    scene('overfit', 'One tree overfits', `Grow a single decision tree deep and it carves a jagged box around every training point — memorizing the noise. Here it gets ${(singleTrainAcc * 100).toFixed(0)}% on training data but only ${(singleTestAcc * 100).toFixed(0)}% on fresh test points: its wild boundary doesn't generalize.`),
    scene('bag', 'Bagging: trees on random resamples', 'Instead, train many trees, each on a bootstrap sample — a random resample of the data with replacement — and let each split see only a random subset of the features. Every tree ends up slightly different, making its own idiosyncratic mistakes on the noise.'),
    scene('vote', 'Vote across the forest', 'To classify a point, poll all the trees and take the majority vote. Where one tree is fooled by noise, most others aren’t, so the wrong votes get outnumbered. The shaded boundary is now a soft blend of votes, not one tree’s hard jagged line.'),
    scene('cancel', 'Errors cancel — variance drops', 'Because the trees are decorrelated, their random errors average out. The forest keeps a tree’s flexibility (low bias) but slashes the jitter (variance) — the jagged single-tree boundary becomes a smooth, stable one that generalizes to new points far better.'),
    scene('crowd', 'Wisdom of crowds, for models', 'This is the bias-variance win of ensembling: many diverse, individually-overfit models averaged together beat any one of them. It’s why random forests — and their sequential cousin, gradient boosting — are still a top method for everyday tabular data.'),
    { key: 'run', title: 'Grow the forest', caption: `Slide from 1 tree to many. At 1 the boundary is jagged and overfit; as trees are added, their votes blend into a smooth circular boundary that matches the true shape, and test accuracy climbs from the single tree’s ${(singleTestAcc * 100).toFixed(0)}% toward the forest’s. More trees never overfit — they only stabilize.`, render: () => <RF phase="run" n={nTrees} testAcc={testAcc} onN={setN} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A single decision tree grown deep <strong>overfits</strong>: it carves a jagged box around every training point, memorizing noise, so it aces the training data but generalizes poorly. A <strong>random forest</strong> trains many trees — each on a random resample of the data (a bootstrap sample) and seeing a random subset of features at each split — and averages their votes. The trees make different mistakes, so their errors cancel, and the averaged boundary is smooth and generalizes far better than any single tree.</>,
        takeaway: <>A random forest is an ensemble of decision trees built with two sources of randomness that <strong>decorrelate</strong> them: <strong>bagging</strong> (each tree trains on a bootstrap sample — n points drawn with replacement, ~63% of the data with duplicates) and <strong>random feature subsets</strong> (each split considers only a random handful of features). To predict it takes a majority vote (classification) or average (regression). Why it works is <strong>bias-variance</strong>: a deep tree is low-bias but high-variance — it fits the signal and the noise, so small data changes swing its boundary wildly. Averaging many decorrelated high-variance predictors leaves the bias unchanged but drives the variance down roughly in proportion to the number of independent trees, so the ensemble keeps the trees’ flexibility while erasing their jitter (verified here: the forest’s test accuracy beats a single deep tree’s — ~76% vs ~71% — and its boundary is visibly smoother, and adding trees never overfits). The trees <em>must</em> be decorrelated — that’s exactly what bagging and feature randomness buy; perfectly correlated trees would average to no gain. Forests need little tuning, give a free out-of-bag error estimate and feature-importance scores, and — with gradient boosting, which adds trees sequentially to fix each other’s errors — remain the go-to for tabular data.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="rf-ctl">trees<input type="range" min={1} max={NMAX} value={nTrees} onChange={(e) => setN(+e.target.value)} /><b>{nTrees}</b> · forest test accuracy <b>{(testAcc * 100).toFixed(1)}%</b> vs single tree {(singleTestAcc * 100).toFixed(0)}%</label>
      )}
    />
  );
}

function RF({ phase, n, testAcc, onN }: { phase: Phase; n: number; testAcc: number; onN?: (n: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onN;
  const single = on('overfit');
  const cell = SZ / G;
  const rects = [];
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const f = single ? singleCell[i * G + j] : cellCum[n - 1][i * G + j] / n;
    const a = Math.abs(f - 0.5) * 1.7; const hue = f < 0.5 ? 30 : 210;
    rects.push(<rect key={i + '-' + j} x={OX + i * cell} y={OY + (G - 1 - j) * cell} width={cell + 0.6} height={cell + 0.6} fill={`hsl(${hue} 62% 52% / ${a})`} />);
  }
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="28" className="rf-col">{single ? '1 deep tree' : `${n} trees, majority vote`} · test accuracy {(testAcc * 100).toFixed(1)}%{single ? ' (overfit)' : ''}</text>
      {rects}
      <rect x={OX} y={OY} width={SZ} height={SZ} className="rf-frame" />
      {TRAIN.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3.1" className="rf-pt" style={{ fill: p[2] === 1 ? 'hsl(210 75% 66%)' : 'hsl(30 85% 60%)' }} />)}
      <text x={OX} y={OY + SZ + 20} className="rf-leg" style={{ fill: 'hsl(30 80% 62%)' }}>class 0</text>
      <text x={OX + SZ} y={OY + SZ + 20} className="rf-leg" textAnchor="end" style={{ fill: 'hsl(210 75% 66%)' }}>class 1</text>
      <text x="450" y="398" className="rf-foot" textAnchor="middle">
        {on('overfit') ? 'jagged boundary boxing every point — memorized, not learned'
          : on('bag') ? 'each tree: a bootstrap resample + random features → all different'
          : on('vote') ? 'majority vote blends the trees → a soft, averaged boundary'
          : on('cancel') ? 'decorrelated errors cancel → smooth boundary, lower variance'
          : on('crowd') ? 'many overfit trees averaged beat any single one — ensembling'
          : `${n} trees → ${(testAcc * 100).toFixed(1)}% test — smooths toward the true circle`}
      </text>
    </svg>
  );
}
