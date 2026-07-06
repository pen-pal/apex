// Guided story: logistic regression — the probabilistic upgrade of the perceptron. Linear score z = w·x + b,
// squashed through the sigmoid σ(z)=1/(1+e^-z) into a probability, trained by gradient descent on the CONVEX
// cross-entropy loss (one bowl, no local minima → the global min from any start). DEEPENED so you PRODUCE and
// BREAK the wall a master knows and a novice doesn't — it is LINEAR:
//  · "two blobs" (roughly separable): a line splits them, ~91% accuracy, loss ~0.245.
//  · "XOR" (checkerboard, class = (x>½) XOR (y>½)): NO straight line separates it, so accuracy is pinned at
//    ~50% (chance) no matter how long it trains — yet the convex loss still CONVERGES (to ~0.69 = predicting 0.5
//    everywhere). "The loss converged" ≠ "it classifies." That is the linearity wall — the reason hidden layers exist.
//  · add one nonlinear feature (x−½)(y−½) and the boundary bends → ~99%. That is what a hidden layer does.
// Node-verified: blobs loss 0.245/acc 91%; XOR loss 0.692/acc 49%; XOR+feature acc 99%.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Pt = [number, number, number];
function blobs(): Pt[] {
  let s = 61; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const g = () => { const a = Math.max(1e-9, r()), b = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
  const p: Pt[] = []; for (let i = 0; i < 46; i++) { p.push([0.35 + g() * 0.12, 0.5 + g() * 0.15, 0]); p.push([0.65 + g() * 0.12, 0.5 + g() * 0.15, 1]); } return p;
}
function xor(): Pt[] {
  let s = 61; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const g = () => { const a = Math.max(1e-9, r()), b = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
  const cen = [[0.3, 0.3, 0], [0.7, 0.7, 0], [0.3, 0.7, 1], [0.7, 0.3, 1]]; const p: Pt[] = [];
  for (let i = 0; i < 23; i++) for (const [cx, cy, t] of cen) p.push([cx + g() * 0.08, cy + g() * 0.08, t]);
  return p;
}
const DATASETS = { blobs, xor } as const;
type Ds = keyof typeof DATASETS;

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const fval = (x: number, y: number, feat: boolean) => feat ? (x - 0.5) * (y - 0.5) : 0; // one nonlinear feature (the fix)
const score = (w: number[], b: number, x: number, y: number, feat: boolean) => w[0] * x + w[1] * y + w[2] * fval(x, y, feat) + b;
function loss(D: Pt[], w: number[], b: number, feat: boolean): number { let L = 0; for (const [x, y, t] of D) { const p = sig(score(w, b, x, y, feat)); L -= t * Math.log(p + 1e-12) + (1 - t) * Math.log(1 - p + 1e-12); } return L / D.length; }
function accuracy(D: Pt[], w: number[], b: number, feat: boolean): number { let c = 0; for (const [x, y, t] of D) if ((sig(score(w, b, x, y, feat)) >= 0.5 ? 1 : 0) === t) c++; return c / D.length; }
function gradStep(D: Pt[], w: number[], b: number, eta: number, feat: boolean): [number[], number] {
  let g0 = 0, g1 = 0, g2 = 0, gb = 0; for (const [x, y, t] of D) { const p = sig(score(w, b, x, y, feat)); const e = p - t; g0 += e * x; g1 += e * y; g2 += e * fval(x, y, feat); gb += e; }
  const n = D.length; return [[w[0] - eta * g0 / n, w[1] - eta * g1 / n, w[2] - eta * g2 / n], b - eta * gb / n];
}
const OX = 250, OY = 18, SZ = 372, G = 20;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;

type Phase = 'hard' | 'sigmoid' | 'crossent' | 'convex' | 'outlayer' | 'run';

export function LogisticRegressionSection() {
  const [ds, setDs] = useState<Ds>('blobs');
  const [feat, setFeat] = useState(false);
  const cfg = useRef({ D: blobs() as Pt[], feat: false });
  const w = useRef<number[]>([0, 0, 0]); const bRef = useRef(0); const lossRef = useRef(0); const accRef = useRef(0); const stepRef = useRef(0); const conv = useRef(false);
  const [, tick] = useState(0); const frame = useRef(0);
  const reset = () => { w.current = [0, 0, 0]; bRef.current = 0; const c = cfg.current; lossRef.current = loss(c.D, [0, 0, 0], 0, c.feat); accRef.current = accuracy(c.D, [0, 0, 0], 0, c.feat); stepRef.current = 0; conv.current = false; };
  useEffect(() => { cfg.current = { D: DATASETS[ds](), feat }; reset(); tick((t) => t + 1); }, [ds, feat]);

  useEffect(() => {
    reset();
    let raf = 0; const loop = () => {
      frame.current++; const c = cfg.current;
      if (frame.current % 5 === 0 && !conv.current) {
        const before = lossRef.current;
        for (let k = 0; k < 3; k++) { const [nw, nb] = gradStep(c.D, w.current, bRef.current, 4, c.feat); w.current = nw; bRef.current = nb; }
        lossRef.current = loss(c.D, w.current, bRef.current, c.feat); accRef.current = accuracy(c.D, w.current, bRef.current, c.feat); stepRef.current += 3;
        if (Math.abs(before - lossRef.current) < 1e-6) conv.current = true;
        tick((t) => (t + 1) % 100000);
      }
      if (conv.current && frame.current % 320 === 0) reset();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <LR phase={key} D={cfg.current.D} feat={cfg.current.feat} ds={ds} w={w.current} b={bRef.current} loss={lossRef.current} acc={accRef.current} step={stepRef.current} conv={conv.current} /> });

  const scenes: StoryScene[] = [
    scene('hard', 'From a hard line to a probability', 'The perceptron gives a bare yes/no — no confidence, and its training only settles if the classes split perfectly. Logistic regression keeps the same linear boundary but reports a probability, and trains in a way that always converges. Keep an eye on that word linear — it’s the whole story.'),
    scene('sigmoid', 'The sigmoid squashes to (0,1)', 'Take the same weighted sum z = w·x + b, then pass it through the sigmoid σ(z) = 1/(1+e^−z). Far on the positive side it saturates toward 1, far negative toward 0, and exactly on the boundary it’s 0.5. The background shades that probability — deep blue and deep orange are confident, the pale band is “not sure”.'),
    scene('crossent', 'Cross-entropy punishes confident mistakes', 'To train, score the fit with cross-entropy loss: it barely penalizes a correct, confident prediction but shoots toward infinity when the model is confidently wrong. Averaged over all points, that single number is what training drives down.'),
    scene('convex', 'Convex, so gradient descent always converges', 'The cross-entropy loss is convex in the weights — one smooth bowl, no local minima — so gradient descent slides to the one global minimum from any start. But watch the trap: “the loss converged” only means it found the best LINE. If no line can separate the classes, it still converges — to a useless one.'),
    scene('outlayer', 'The output unit of a neural net', 'Logistic regression is the perceptron made probabilistic — same linear model, calibrated confidence, a loss that always converges. It’s exactly the unit at the output of a classifier network (its multiclass form is the softmax), and this gradient-descent-on-cross-entropy recipe trains the whole network.'),
    { key: 'run', title: 'Hit the wall — then break through it', caption: 'On “two blobs” gradient descent swings a line into place and reaches ~91% accuracy. Now switch to “XOR” — class = (x above ½) XOR (y above ½), a checkerboard. The loss still converges (it’s convex), but watch the accuracy: it sticks at ~50%, pure chance, forever, because NO straight line can separate a checkerboard. That is the linearity wall — the reason a single linear layer isn’t enough. Then flip on the (x−½)(y−½) feature: one nonlinear term bends the boundary and accuracy jumps to ~99%. That is exactly what a hidden layer does.', render: () => <LR phase="run" D={cfg.current.D} feat={cfg.current.feat} ds={ds} w={w.current} b={bRef.current} loss={lossRef.current} acc={accRef.current} step={stepRef.current} conv={conv.current} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The perceptron gives a hard label with no confidence, and only settles if the classes are perfectly separable. <strong>Logistic regression</strong> keeps the same linear boundary but pushes the weighted sum through a <strong>sigmoid</strong> to output a probability, and trains by gradient descent on the <strong>convex</strong> cross-entropy loss, so it always converges. The limit you can trigger here: it is still <em>linear</em> — hand it a checkerboard (XOR) and no line can separate it, so it converges to a classifier that’s no better than a coin flip.</>,
        takeaway: <>Logistic regression computes <code>p = σ(w·x + b)</code>, squashing the linear score to a probability in (0,1), and minimizes the <strong>cross-entropy</strong> loss <code>−[y·log p + (1−y)·log(1−p)]</code> — gentle on confident-correct, unbounded on confident-wrong. That loss is <strong>convex</strong>, so gradient descent (<code>w ← w − η∇loss</code>, gradient <code>Σ(p − y)x</code>) reaches the unique global minimum from any start. But convergence of the loss is not the same as classifying well: because the decision boundary is a straight <strong>line</strong> (a hyperplane in general), any pattern that isn’t linearly separable — the classic being <strong>XOR</strong>, a checkerboard — is impossible for it, and it converges to ~chance accuracy while the loss dutifully bottoms out. The fix is to give it a <strong>nonlinear feature</strong> (here the product <code>(x−½)(y−½)</code>) so the boundary can bend — and stacking learned nonlinear features is exactly what a neural network’s <strong>hidden layers</strong> do. Logistic regression itself is the unit at a classifier network’s output (multiclass = softmax), so this same gradient-descent-on-cross-entropy recipe trains deep networks; the hidden layers are what let them cross the linearity wall you just hit.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="lr-ctl">
          <div className="lr-ctl-row">
            <span className="lr-ctl-lbl">data</span>
            <button type="button" className={`lr-btn ${ds === 'blobs' ? 'on' : ''}`} onClick={() => setDs('blobs')}>two blobs</button>
            <button type="button" className={`lr-btn ${ds === 'xor' ? 'on' : ''}`} onClick={() => setDs('xor')}>XOR</button>
            <button type="button" className={`lr-btn ${feat ? 'on' : ''}`} onClick={() => setFeat((f) => !f)}>{feat ? '✓ ' : '+ '}feature (x−½)(y−½)</button>
          </div>
          <span className={`lr-live ${ds === 'xor' && !feat ? 'warn' : ''}`}>
            step {stepRef.current} · loss {lossRef.current.toFixed(3)}{conv.current ? ' converged' : ''} · <b>accuracy {(accRef.current * 100).toFixed(0)}%</b>
            {ds === 'xor' && !feat ? ' — the loss converged, but no line can split a checkerboard (≈chance). The linearity wall.' : ds === 'xor' && feat ? ' — one bent feature clears it ✓ (what a hidden layer does)' : accRef.current > 0.85 ? ' — a line separates them ✓' : ''}
          </span>
        </div>
      )}
    />
  );
}

function LR({ phase, D, feat, ds, w, b, loss: L, acc, step, conv }: { phase: Phase; D: Pt[]; feat: boolean; ds: Ds; w: number[]; b: number; loss: number; acc: number; step: number; conv: boolean }) {
  const on = (p: Phase) => phase === p;
  const cell = SZ / G;
  const cells = [];
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const cx = (i + 0.5) / G, cy = (j + 0.5) / G; const p = sig(score(w, b, cx, cy, feat));
    const a = Math.abs(p - 0.5) * 1.7; const hue = p < 0.5 ? 30 : 210;
    cells.push(<rect key={i + '-' + j} x={OX + i * cell} y={OY + (G - 1 - j) * cell} width={cell + 0.5} height={cell + 0.5} fill={`hsl(${hue} 65% 55% / ${a})`} />);
  }
  // the linear p=0.5 boundary is a line only when there is no bending feature
  const lin = !feat && (Math.abs(w[0]) > 1e-6 || Math.abs(w[1]) > 1e-6);
  const bl = Math.abs(w[1]) >= Math.abs(w[0]) ? [[0, -(w[0] * 0 + b) / (w[1] || 1e-6)], [1, -(w[0] * 1 + b) / (w[1] || 1e-6)]] : [[-(w[1] * 0 + b) / (w[0] || 1e-6), 0], [-(w[1] * 1 + b) / (w[0] || 1e-6), 1]];
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="28" className={`lr-col ${ds === 'xor' && !feat ? 'warn' : ''}`}>P(class) = σ(w·x + b{feat ? ' + w₃(x−½)(y−½)' : ''}){!on('hard') ? ` · step ${step} · loss ${L.toFixed(3)} · acc ${(acc * 100).toFixed(0)}%` : ''}</text>
      {!on('hard') && cells}
      <rect x={OX} y={OY} width={SZ} height={SZ} className="lr-frame" />
      {!on('hard') && lin && <line x1={sx(bl[0][0])} y1={sy(bl[0][1])} x2={sx(bl[1][0])} y2={sy(bl[1][1])} className="lr-line" />}
      {D.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3.6" className="lr-pt" style={{ fill: p[2] === 1 ? 'hsl(210 75% 66%)' : 'hsl(30 85% 62%)' }} />)}
      <text x={OX} y={OY + SZ + 20} className="lr-leg" style={{ fill: 'hsl(30 80% 62%)' }}>P→0 (orange)</text>
      <text x={OX + SZ} y={OY + SZ + 20} className="lr-leg" textAnchor="end" style={{ fill: 'hsl(210 75% 66%)' }}>P→1 (blue)</text>
      <text x="450" y="398" className={`lr-foot ${ds === 'xor' && !feat ? 'warn' : ''}`} textAnchor="middle">
        {on('hard') ? 'a linear boundary + a probability — the perceptron upgraded'
          : on('sigmoid') ? 'sigmoid: 0.5 at the boundary, saturating to 0 and 1 away from it'
          : on('crossent') ? 'cross-entropy: tiny when confident-right, huge when confident-wrong'
          : on('convex') ? 'convex loss converges — but only to the best LINE, useless if none separates'
          : on('outlayer') ? 'the same sigmoid + cross-entropy is a neural net’s output unit'
          : ds === 'xor' && !feat ? 'a checkerboard: no line works → accuracy stuck at chance (the linearity wall)'
          : ds === 'xor' && feat ? 'the (x−½)(y−½) feature bends the boundary → the checkerboard is solved'
          : conv ? `converged: loss ${L.toFixed(3)} · accuracy ${(acc * 100).toFixed(0)}%` : `descending… loss ${L.toFixed(3)}`}
      </text>
    </svg>
  );
}
