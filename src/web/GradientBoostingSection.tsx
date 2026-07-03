// Guided story: gradient boosting — the sequential ensemble. Start with a constant prediction, then repeatedly fit a
// small tree to the RESIDUAL errors (target − current prediction) and add a shrunk copy to the model. For squared
// loss the residual is the negative gradient of the loss, so each tree is one step of gradient descent in function
// space, and the train loss drops monotonically. Verified in node: MSE falls 0.0497→0.0002 (281x) over 40 rounds,
// never rising. The sequential counterpart to a random forest's parallel bagging. Live 1-D regression. Sandboxed.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const NP = 68, NROUND = 40, LR = 0.3, MAXD = 2;
const X = Array.from({ length: NP }, (_, i) => i / (NP - 1));
const target = (x: number) => Math.sin(x * 6.5) * 0.6 + (x > 0.55 ? 0.3 : -0.25) + 0.1 * Math.sin(x * 17);
const Y = X.map(target);
type RNode = { leaf: 1; v: number } | { leaf: 0; t: number; L: RNode; R: RNode };
function sse(idx: number[], r: number[]): [number, number] { if (!idx.length) return [0, 0]; let m = 0; for (const i of idx) m += r[i]; m /= idx.length; let s = 0; for (const i of idx) s += (r[i] - m) ** 2; return [s, m]; }
function tree(idx: number[], r: number[], depth: number): RNode { const [s, mean] = sse(idx, r); if (depth >= MAXD || idx.length < 3 || s < 1e-9) return { leaf: 1, v: mean };
  let best: { t: number; L: number[]; R: number[]; err: number } | null = null; const xs = idx.map((i) => X[i]);
  for (let k = 0; k < idx.length - 1; k++) { const t = (xs[k] + xs[k + 1]) / 2; const L = idx.filter((i) => X[i] <= t), Rr = idx.filter((i) => X[i] > t); if (!L.length || !Rr.length) continue; const [sl] = sse(L, r), [sr] = sse(Rr, r); if (!best || sl + sr < best.err) best = { t, L, R: Rr, err: sl + sr }; }
  if (!best) return { leaf: 1, v: mean };
  return { leaf: 0, t: best.t, L: tree(best.L, r, depth + 1), R: tree(best.R, r, depth + 1) };
}
const evalT = (n: RNode, x: number): number => { while (n.leaf === 0) n = x <= n.t ? n.L : n.R; return n.v; };
// precompute cumulative model predictions F[m][i] and MSE[m]
const F: number[][] = []; const MSE: number[] = [];
{ const idxAll = X.map((_, i) => i); let cur = X.map(() => Y.reduce((a, b) => a + b, 0) / Y.length);
  F.push([...cur]); MSE.push(cur.reduce((a, f, i) => a + (Y[i] - f) ** 2, 0) / NP);
  for (let m = 1; m <= NROUND; m++) { const r = Y.map((y, i) => y - cur[i]); const h = tree(idxAll, r, 0); cur = cur.map((f, i) => f + LR * evalT(h, X[i])); F.push([...cur]); MSE.push(cur.reduce((a, f, i) => a + (Y[i] - f) ** 2, 0) / NP); } }

const OX = 88, OY = 40, PW = 764, PH = 296;
const sx = (x: number) => OX + x * PW;
const sy = (v: number) => OY + PH * (1.2 - v) / 2.4;

type Phase = 'weak' | 'residual' | 'add' | 'gradient' | 'sequential' | 'run';

export function GradientBoostingSection() {
  const [m, setM] = useState(20);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, mm: number): StoryScene =>
    ({ key, title, caption, render: () => <GB phase={key} m={mm} /> });

  const scenes: StoryScene[] = [
    scene('weak', 'Start weak, aim to improve', 'Begin with the simplest possible model: predict the average target value for every point — a flat line. The vertical stubs are the residuals, how far each point is from that guess. Big and everywhere. The plan is to chip away at them, a little at a time.', 0),
    scene('residual', 'Fit a tree to the residuals', 'Now fit one small tree — not to the target, but to those residuals. It finds where the current model is most wrong and predicts a correction there. It’s a crude step (a shallow tree), so it only captures the coarsest leftover structure.', 1),
    scene('add', 'Add it, then repeat', 'Add a shrunk copy of that correction (scaled by a small learning rate) to the model, and the prediction bends toward the data. Compute the new, smaller residuals and fit another tree to those. Each round targets exactly what the ensemble still gets wrong.', 4),
    scene('gradient', 'Each tree is a gradient step', 'Here’s why it’s called gradient boosting: for squared-error loss, the residual (target − prediction) is exactly the negative gradient of the loss. So each tree takes one step of gradient descent — but in function space, adding a whole function instead of nudging a number. The loss falls every round.', 14),
    scene('sequential', 'Sequential, unlike a forest', 'A random forest grows many trees in parallel and averages them; boosting grows them in sequence, each fixing the errors of the ones before. That dependency makes boosting fit complex targets with tiny trees — and why a small learning rate plus many rounds resists overfitting.', 34),
    { key: 'run', title: 'Boost round by round', caption: 'Slide the number of rounds up. The flat line grows a staircase that hugs the wiggly target ever more tightly, the residual stubs shrink toward nothing, and the training loss drops monotonically — never rising, because every tree is fit to what’s still wrong. Weak learners, added greedily, become a strong one.', render: () => <GB phase="run" m={m} onM={setM} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Gradient boosting builds a strong model out of many weak ones, added one at a time. Start with a trivial prediction (the average), then repeatedly fit a small tree to the <strong>residuals</strong> — the errors the current model still makes — and add a shrunken copy of it. Each new tree targets exactly what the ensemble gets wrong, so the prediction bends toward the data round by round. Because for squared loss the residual <em>is</em> the negative gradient of the loss, each tree is one step of gradient descent, and the training loss falls every round.</>,
        takeaway: <>Gradient boosting fits an additive model <code>F(x) = F₀ + η·Σ hₘ(x)</code> stagewise. It starts with a constant F₀ (the mean for squared loss), then at each round m computes the <strong>residuals</strong> <code>r = y − F(x)</code>, fits a small regression tree <code>hₘ</code> to those residuals, and adds a shrunken copy <code>η·hₘ</code> (η is the learning rate). The key insight: the residual for squared-error loss is exactly the <strong>negative gradient</strong> of the loss with respect to the current prediction, so fitting a tree to it and adding it is a step of <strong>gradient descent in function space</strong> — hence “gradient” boosting; for other losses you fit the tree to that loss’s negative gradient instead. Each round reduces the training loss (verified here: MSE falls monotonically 0.0497→0.0002, ~281× over 40 rounds), and shallow trees (“weak learners”) suffice because their errors are corrected by later trees. This is the opposite construction to a random forest: a forest grows deep trees <em>in parallel</em> on bootstrap samples and averages to cut variance, while boosting grows shallow trees <em>sequentially</em>, each dependent on the last, to cut bias. A small learning rate with many trees (plus subsampling and tree-depth limits) controls overfitting; implementations like XGBoost and LightGBM add second-order gradients and regularization and are the dominant method for tabular machine-learning competitions.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="gb-ctl">boosting rounds<input type="range" min={0} max={NROUND} value={m} onChange={(e) => setM(+e.target.value)} /><b>{m}</b> · training loss (MSE) <b>{MSE[m].toFixed(4)}</b>{m > 0 ? ` · ${(MSE[0] / MSE[m]).toFixed(0)}× smaller` : ''}</label>
      )}
    />
  );
}

function GB({ phase, m, onM }: { phase: Phase; m: number; onM?: (m: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onM;
  const pred = F[m];
  const showResid = !on('sequential');
  return (
    <svg viewBox="0 0 900 400" className="story-svg">
      <text x="60" y="24" className="gb-col">{m === 0 ? 'model = mean (flat)' : `${m} tree${m === 1 ? '' : 's'} added`} · training loss {MSE[m].toFixed(4)}{m > 0 ? ` (${(MSE[0] / MSE[m]).toFixed(0)}× smaller)` : ''}</text>
      <rect x={OX} y={OY} width={PW} height={PH} className="gb-frame" />
      <line x1={OX} y1={sy(0)} x2={OX + PW} y2={sy(0)} className="gb-zero" />

      {/* residual stubs */}
      {showResid && X.map((x, i) => <line key={'r' + i} x1={sx(x)} y1={sy(pred[i])} x2={sx(x)} y2={sy(Y[i])} className="gb-resid" />)}

      {/* target points */}
      {X.map((x, i) => <circle key={i} cx={sx(x)} cy={sy(Y[i])} r="2.6" className="gb-target" />)}

      {/* model prediction (staircase) */}
      <polyline points={X.map((x, i) => `${sx(x).toFixed(1)},${sy(pred[i]).toFixed(1)}`).join(' ')} className="gb-model" fill="none" />

      <text x={OX} y={OY - 8} className="gb-leg">● target · ── model prediction · │ residual (error)</text>
      <text x="450" y="392" className="gb-foot" textAnchor="middle">
        {on('weak') ? 'a flat mean prediction — every residual is large'
          : on('residual') ? 'one shallow tree fits the residuals: a coarse first correction'
          : on('add') ? 'add the shrunk correction, recompute residuals, repeat'
          : on('gradient') ? 'residual = −gradient of squared loss → each tree is a descent step'
          : on('sequential') ? 'sequential corrections build a staircase hugging the target'
          : `${m} rounds → MSE ${MSE[m].toFixed(4)} — residuals shrink, loss only falls`}
      </text>
    </svg>
  );
}
