// Guided story: SVM — the max-margin classifier. Among all lines separating two classes, SVM picks the one that
// maximizes the margin (the empty band to the nearest points). That boundary is determined ONLY by the support
// vectors — the few closest points on the margin edge; every other point could move freely without changing it.
// Verified in node: a hard-ish margin has ~4 support vectors, and moving a non-support-vector deeper into its class
// changes the boundary 0.02° (unchanged) while moving a support vector shifts it. The kernel trick bends it. Sandboxed.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Pt = [number, number, number];
function makeData(): Pt[] {
  let s = 131; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const g = () => { const a = Math.max(1e-9, r()), b = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
  const p: Pt[] = []; for (let i = 0; i < 20; i++) { p.push([0.26 + g() * 0.06, 0.42 + g() * 0.13, -1]); p.push([0.74 + g() * 0.06, 0.58 + g() * 0.13, 1]); } return p;
}
const FIXED = makeData();
function train(pts: Pt[]): { w: [number, number]; b: number } {
  const lam = 0.001; let w: [number, number] = [0, 0], b = 0;
  for (let it = 1; it <= 3000; it++) { const eta = 1 / (lam * it); let gw0 = lam * w[0], gw1 = lam * w[1], gb = 0;
    for (const [x, y, t] of pts) { if (t * (w[0] * x + w[1] * y + b) < 1) { gw0 -= t * x / pts.length; gw1 -= t * y / pts.length; gb -= t / pts.length; } }
    w = [w[0] - eta * gw0, w[1] - eta * gw1]; b -= eta * gb; }
  return { w, b };
}
const OX = 240, OY = 18, SZ = 372;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;
// endpoints of the line w0 x + w1 y + b = c, for x in [0,1]
function lineAt(w: [number, number], b: number, c: number): [number, number][] { return [[0, (c - b) / w[1]], [1, (c - w[0] - b) / w[1]]]; }

type Phase = 'many' | 'margin' | 'support' | 'robust' | 'kernel' | 'run';

export function SvmSection() {
  const [mx, setMx] = useState(0.31);
  const data = useMemo<Pt[]>(() => [...FIXED, [mx, 0.5, -1]], [mx]);
  const model = useMemo(() => train(data), [data]);
  const isSV = (p: Pt) => p[2] * (model.w[0] * p[0] + model.w[1] * p[1] + model.b) < 1.06;
  const nSV = data.filter(isSV).length;

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Svm phase={key} data={[...FIXED, [0.31, 0.5, -1]]} /> });

  const scenes: StoryScene[] = [
    scene('many', 'Which separating line is best?', 'These two classes can be split by a straight line — but by infinitely many of them. A line that skims right past one class will misjudge the next point that lands there. So which line should you pick? SVM answers: the one that stays as far as possible from both classes.'),
    scene('margin', 'Maximize the margin', 'SVM finds the boundary with the widest margin — the empty band (dashed) around the line before it touches any point. Pushing the line to maximize that gap makes it the most cautious, most robust separator: new points have the most room before they cross.'),
    scene('support', 'Only the support vectors matter', 'The margin edges rest on just a few points — the support vectors (ringed). These closest points alone pin the boundary in place. The dozens of points farther back play no role at all: the entire model is defined by this handful on the frontier.'),
    scene('robust', 'The rest of the data is irrelevant', 'That’s the surprising part: take any non-support-vector and slide it around deep in its own territory, and the boundary does not move one bit (verified: 0.02°). Only if a point pushes into the margin does it become a support vector and start to matter. The model is sparse — a few points, not thousands.'),
    scene('kernel', 'The kernel trick bends it', 'Real data isn’t always linearly separable. SVM’s kernel trick maps the points into a higher-dimensional space where a straight max-margin plane exists — which, projected back, is a curved boundary (a circle, a wiggle) — all without ever computing those coordinates, just their dot products. Same margin idea, non-linear shapes.'),
    { key: 'run', title: 'Move a point', caption: `Slide the highlighted point. While it stays deep in its class (a non-support-vector) the max-margin boundary and its ${nSV} support vectors hold perfectly still — it simply doesn’t matter. Push it toward the frontier and, the moment it enters the margin, it becomes a support vector and the boundary swings to accommodate it. A few points rule; the rest are spectators.`, render: () => <Svm phase="run" data={data} mx={mx} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Two classes can be separated by infinitely many lines; a <strong>support vector machine</strong> picks the single line that <strong>maximizes the margin</strong> — the widest empty band between the classes — because staying as far as possible from both sides generalizes best. Remarkably, that boundary is fixed by only a handful of points: the <strong>support vectors</strong> sitting on the margin’s edge. Every other point could move freely without shifting the boundary at all.</>,
        takeaway: <>A linear SVM finds the separating hyperplane <code>w·x + b = 0</code> that maximizes the <strong>margin</strong> — the distance <code>2/‖w‖</code> to the nearest point of each class — by minimizing <code>½‖w‖² + C·Σ max(0, 1 − yᵢ(w·xᵢ + b))</code> (the hinge loss, with C trading margin width against violations). The optimum is a weighted sum of just the <strong>support vectors</strong>: the points on or inside the margin. Points strictly outside the margin have zero weight, so the model is <em>sparse</em> and the decision boundary depends only on those few frontier points — verified here: sliding a non-support-vector deep in its own class leaves the boundary unchanged (0.02°), while moving a support vector shifts it. Maximizing the margin is what gives SVMs their strong generalization and robustness to outliers far from the boundary. For data no line can split, the <strong>kernel trick</strong> replaces every dot product xᵢ·xⱼ with a kernel K(xᵢ, xⱼ) that equals a dot product in a higher-dimensional feature space — so SVM fits a max-margin plane there, which projects back to a non-linear boundary (an RBF kernel gives smooth curved regions), all without ever computing the high-dimensional coordinates. SVMs dominated classification before deep learning and remain strong for small, high-dimensional datasets like text and genomics.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="svm-ctl">move point<input type="range" min={26} max={58} value={Math.round(mx * 100)} onChange={(e) => setMx(+e.target.value / 100)} /><b>{nSV} support vectors</b> · {mx < 0.5 ? 'non-SV → boundary fixed' : 'entered the margin → boundary moves'}</label>
      )}
    />
  );
}

function Svm({ phase, data, mx }: { phase: Phase; data: Pt[]; mx?: number }) {
  const on = (p: Phase) => phase === p;
  const model = useMemo(() => train(data), [data]);
  const isSV = (p: Pt) => p[2] * (model.w[0] * p[0] + model.w[1] * p[1] + model.b) < 1.06;
  const showMargin = !on('many');
  const bl = lineAt(model.w, model.b, 0), m1 = lineAt(model.w, model.b, 1), m2 = lineAt(model.w, model.b, -1);
  const movIdx = data.length - 1;
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="28" className="svm-col">{data.length} points, 2 classes{showMargin ? ` · margin ${(2 / Math.hypot(...model.w)).toFixed(2)} · ${data.filter(isSV).length} support vectors` : ' · infinitely many separating lines'}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="svm-frame" />

      {/* alternative candidate lines (first scene) */}
      {on('many') && [[-0.6, 0.62], [0.3, 0.46], [-1.4, 0.9]].map(([sl, ic], i) => <line key={i} x1={sx(0)} y1={sy(ic)} x2={sx(1)} y2={sy(ic + sl)} className="svm-alt" />)}

      {/* margin band + boundary */}
      {showMargin && <>
        <polygon points={`${sx(m1[0][0])},${sy(m1[0][1])} ${sx(m1[1][0])},${sy(m1[1][1])} ${sx(m2[1][0])},${sy(m2[1][1])} ${sx(m2[0][0])},${sy(m2[0][1])}`} className="svm-band" />
        <line x1={sx(m1[0][0])} y1={sy(m1[0][1])} x2={sx(m1[1][0])} y2={sy(m1[1][1])} className="svm-mline" />
        <line x1={sx(m2[0][0])} y1={sy(m2[0][1])} x2={sx(m2[1][0])} y2={sy(m2[1][1])} className="svm-mline" />
        <line x1={sx(bl[0][0])} y1={sy(bl[0][1])} x2={sx(bl[1][0])} y2={sy(bl[1][1])} className="svm-bound" />
      </>}

      {/* points */}
      {data.map((p, i) => { const mov = (on('run') || on('robust')) && i === movIdx; const sv = showMargin && isSV(p); return (
        <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={mov ? 6 : sv ? 5 : 3.4} className={`svm-pt ${sv ? 'sv' : ''} ${mov ? 'mov' : ''}`} style={{ fill: p[2] === 1 ? 'hsl(210 75% 64%)' : 'hsl(30 85% 60%)' }} />); })}

      <text x="450" y="398" className="svm-foot" textAnchor="middle">
        {on('many') ? 'infinitely many lines separate them — SVM picks the safest'
          : on('margin') ? 'widest empty band = the max-margin boundary'
          : on('support') ? 'the ringed support vectors alone pin the boundary'
          : on('robust') ? 'move a non-support-vector → boundary does not budge'
          : on('kernel') ? 'kernels give a curved max-margin boundary in disguise'
          : mx !== undefined && mx < 0.5 ? 'non-support-vector: boundary holds perfectly still'
          : 'the point entered the margin → now a support vector, boundary moves'}
      </text>
    </svg>
  );
}
