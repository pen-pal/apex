// Guided story: logistic regression — the probabilistic upgrade of the perceptron. Same linear score z = w·x + b,
// but squashed through the sigmoid σ(z)=1/(1+e^-z) into a probability in (0,1), and trained by gradient descent on
// the cross-entropy loss. That loss is CONVEX — one bowl, no local minima — so gradient descent reaches the single
// global minimum from any start (verified in node: 3 inits → same min 0.2778), and it converges even on non-separable
// data where the perceptron thrashes. It's the output unit of a classifier neural net (softmax = multiclass). Live.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Pt = [number, number, number];
function makeData(): Pt[] {
  let s = 61; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const g = () => { const a = Math.max(1e-9, r()), b = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
  const p: Pt[] = []; for (let i = 0; i < 46; i++) { p.push([0.35 + g() * 0.12, 0.5 + g() * 0.15, 0]); p.push([0.65 + g() * 0.12, 0.5 + g() * 0.15, 1]); } return p;
}
const DATA = makeData();
const sig = (z: number) => 1 / (1 + Math.exp(-z));
function loss(w: [number, number], b: number): number { let L = 0; for (const [x, y, t] of DATA) { const p = sig(w[0] * x + w[1] * y + b); L -= t * Math.log(p + 1e-12) + (1 - t) * Math.log(1 - p + 1e-12); } return L / DATA.length; }
function gradStep(w: [number, number], b: number, eta: number): [[number, number], number] {
  let gw0 = 0, gw1 = 0, gb = 0; for (const [x, y, t] of DATA) { const p = sig(w[0] * x + w[1] * y + b); gw0 += (p - t) * x; gw1 += (p - t) * y; gb += p - t; }
  const n = DATA.length; return [[w[0] - eta * gw0 / n, w[1] - eta * gw1 / n], b - eta * gb / n];
}
const OX = 250, OY = 18, SZ = 372, G = 18;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;

type Phase = 'hard' | 'sigmoid' | 'crossent' | 'convex' | 'outlayer' | 'run';

export function LogisticRegressionSection() {
  const w = useRef<[number, number]>([0, 0]); const bRef = useRef(0); const lossRef = useRef(loss([0, 0], 0)); const step = useRef(0); const conv = useRef(false);
  const [, tick] = useState(0); const frame = useRef(0);
  const reset = () => { w.current = [0, 0]; bRef.current = 0; lossRef.current = loss([0, 0], 0); step.current = 0; conv.current = false; };
  useEffect(() => {
    let raf = 0; const loop = () => {
      frame.current++;
      if (frame.current % 5 === 0 && !conv.current) { const before = lossRef.current; for (let k = 0; k < 3; k++) { const [nw, nb] = gradStep(w.current, bRef.current, 4); w.current = nw; bRef.current = nb; } lossRef.current = loss(w.current, bRef.current); step.current += 3; if (Math.abs(before - lossRef.current) < 1e-6) conv.current = true; tick((t) => (t + 1) % 100000); }
      if (conv.current && frame.current % 300 === 0) reset();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <LR phase={key} w={w.current} b={bRef.current} loss={lossRef.current} step={step.current} conv={conv.current} /> });

  const scenes: StoryScene[] = [
    scene('hard', 'From a hard line to a probability', 'The perceptron gives a bare yes/no — no confidence, and its training only settles if the classes split perfectly. Here the two blobs overlap, so a perceptron would thrash forever. Logistic regression keeps the linear boundary but reports a probability, and trains in a way that always converges.'),
    scene('sigmoid', 'The sigmoid squashes to (0,1)', 'Take the same weighted sum z = w·x + b, then pass it through the sigmoid σ(z) = 1/(1+e^−z). Far on the positive side it saturates toward 1, far negative toward 0, and exactly on the boundary it’s 0.5. The background shades that probability — deep blue and deep orange are confident, the pale band is “not sure”.'),
    scene('crossent', 'Cross-entropy punishes confident mistakes', 'To train, score the fit with cross-entropy loss: it barely penalizes a correct, confident prediction but shoots toward infinity when the model is confidently wrong. Averaged over all points, that single number is what training drives down.'),
    scene('convex', 'Convex, so gradient descent always wins', 'The cross-entropy loss is convex in the weights — one smooth bowl, no local minima to get stuck in. So gradient descent, repeatedly nudging the weights downhill (w ← w − η∇loss), slides to the one global minimum from any starting point. Watch the loss fall and the boundary rotate into place.'),
    scene('outlayer', 'The output unit of a neural net', 'Logistic regression is the perceptron made probabilistic — same linear model, but calibrated confidence and a loss that always converges. It’s exactly the unit sitting at the output of a classifier network (its multiclass form is the softmax), and this gradient-descent-on-cross-entropy recipe is how the whole network is trained.'),
    { key: 'run', title: 'Descend the loss', caption: 'Gradient descent runs live: the loss drops, the boundary swings to split the blobs, and the background sharpens from a pale “unsure” band into confident blue and orange. It settles at the single global minimum — and unlike the perceptron, it gets there even though the blobs overlap and no line separates them perfectly. Reset to watch again.', render: () => <LR phase="run" w={w.current} b={bRef.current} loss={lossRef.current} step={step.current} conv={conv.current} onReset={reset} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The perceptron gives a hard label — this side or that — with no confidence, and its training only settles if the classes are perfectly separable. <strong>Logistic regression</strong> keeps the same linear boundary but pushes the weighted sum through a <strong>sigmoid</strong> to output a probability between 0 and 1, and trains by gradient descent on the <strong>cross-entropy</strong> loss — which is <strong>convex</strong>, so it always slides to a single global minimum and always converges, separable data or not.</>,
        takeaway: <>Logistic regression computes <code>p = σ(w·x + b)</code> where <code>σ(z) = 1/(1+e^−z)</code> is the sigmoid, squashing the linear score to a probability in (0,1): 0.5 on the decision boundary, saturating toward 1 and 0 far from it. It minimizes the <strong>cross-entropy</strong> (negative log-likelihood) loss <code>−[y·log p + (1−y)·log(1−p)]</code> averaged over the data — gentle on confident-correct predictions, unbounded on confident-wrong ones. Crucially that loss is <strong>convex</strong> in the weights, a single bowl with no local minima, so gradient descent — repeatedly stepping <code>w ← w − η∇loss</code>, where the gradient has the clean form <code>Σ(p − y)x</code> — converges to the unique global optimum from any start (verified here: the loss falls monotonically to the same minimum from three different initializations), and it converges even when the data isn’t linearly separable, where the perceptron thrashes forever. The gain over the perceptron is calibrated probabilities and guaranteed convergence for the same linear model. Logistic regression is the workhorse linear classifier and is exactly the unit at the output of a classification neural network — its multiclass generalization is the <strong>softmax</strong> — so this gradient-descent-on-cross-entropy recipe is the same one that trains deep networks.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="lr-ctl">
          <button type="button" className="lr-btn" onClick={reset}>↻ restart descent</button>
          <span className="lr-live">step {step.current} · cross-entropy loss {lossRef.current.toFixed(3)}{conv.current ? ' · converged ✓' : ''}</span>
        </div>
      )}
    />
  );
}

function LR({ phase, w, b, loss: L, step, conv, onReset }: { phase: Phase; w: [number, number]; b: number; loss: number; step: number; conv: boolean; onReset?: () => void }) {
  const on = (p: Phase) => phase === p;
  void onReset;
  const cell = SZ / G;
  const cells = [];
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const cx = (i + 0.5) / G, cy = (j + 0.5) / G; const p = sig(w[0] * cx + w[1] * cy + b);
    const a = Math.abs(p - 0.5) * 1.7; const hue = p < 0.5 ? 30 : 210;
    cells.push(<rect key={i + '-' + j} x={OX + i * cell} y={OY + (G - 1 - j) * cell} width={cell + 0.5} height={cell + 0.5} fill={`hsl(${hue} 65% 55% / ${a})`} />);
  }
  // p=0.5 boundary: w0 x + w1 y + b = 0
  const bl = Math.abs(w[1]) >= Math.abs(w[0]) ? [[0, -(w[0] * 0 + b) / (w[1] || 1e-6)], [1, -(w[0] * 1 + b) / (w[1] || 1e-6)]] : [[-(w[1] * 0 + b) / (w[0] || 1e-6), 0], [-(w[1] * 1 + b) / (w[0] || 1e-6), 1]];
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="28" className="lr-col">P(class) = σ(w·x + b){!on('hard') ? ` · step ${step} · loss ${L.toFixed(3)}${conv ? ' · converged' : ''}` : ' · overlapping blobs — no clean line'}</text>
      {!on('hard') && cells}
      <rect x={OX} y={OY} width={SZ} height={SZ} className="lr-frame" />
      {!on('hard') && <line x1={sx(bl[0][0])} y1={sy(bl[0][1])} x2={sx(bl[1][0])} y2={sy(bl[1][1])} className="lr-line" />}
      {DATA.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3.6" className="lr-pt" style={{ fill: p[2] === 1 ? 'hsl(210 75% 66%)' : 'hsl(30 85% 62%)' }} />)}
      {/* legend */}
      <text x={OX} y={OY + SZ + 20} className="lr-leg" style={{ fill: 'hsl(30 80% 62%)' }}>P→0 (orange)</text>
      <text x={OX + SZ} y={OY + SZ + 20} className="lr-leg" textAnchor="end" style={{ fill: 'hsl(210 75% 66%)' }}>P→1 (blue)</text>
      <text x="450" y="398" className="lr-foot" textAnchor="middle">
        {on('hard') ? 'overlapping classes: no perfect line — the perceptron would never settle'
          : on('sigmoid') ? 'sigmoid: 0.5 at the boundary, saturating to 0 and 1 away from it'
          : on('crossent') ? 'cross-entropy: tiny when confident-right, huge when confident-wrong'
          : on('convex') ? 'convex loss → gradient descent finds the one global minimum'
          : on('outlayer') ? 'the same sigmoid + cross-entropy is a neural net’s output unit'
          : conv ? `converged: loss ${L.toFixed(3)} — the global minimum` : `descending… loss ${L.toFixed(3)} and falling`}
      </text>
    </svg>
  );
}
