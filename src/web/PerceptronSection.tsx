// Guided story: the perceptron (Rosenblatt, 1958) — the original artificial neuron and ancestor of every neural net.
// output = step(w·x + b): a weighted sum, thresholded → a line splitting the plane. It learns by nudging weights
// toward misclassified points. Rosenblatt's convergence theorem: on linearly-separable data the rule finds a
// separating line in finite steps (verified: converges in a handful of epochs) — but it can only draw ONE line, so it can't do
// XOR (verified: never converges). That limitation, until backprop + layers, stalled neural nets. Live animation.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const sign = (z: number) => (z >= 0 ? 1 : -1);
function makeSep(): [number, number, number][] {
  let s = 41; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const d: [number, number, number][] = [];
  for (let i = 0; i < 24; i++) { d.push([0.14 + r() * 0.28, 0.2 + r() * 0.4, 1]); d.push([0.62 + r() * 0.28, 0.45 + r() * 0.4, -1]); }
  return d;
}
function makeXor(): [number, number, number][] {
  let s = 7; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const d: [number, number, number][] = []; const c = [[0.25, 0.25, 1], [0.75, 0.75, 1], [0.25, 0.75, -1], [0.75, 0.25, -1]];
  for (const [cx, cy, l] of c) for (let i = 0; i < 12; i++) d.push([cx + (r() - 0.5) * 0.22, cy + (r() - 0.5) * 0.22, l]);
  return d;
}
const OX = 210, OY = 22, SZ = 356;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;
function boundary(w: [number, number], b: number): [number, number][] {
  if (Math.abs(w[1]) >= Math.abs(w[0])) return [[-2, (w[0] * 2 - b) / w[1]], [2, (-w[0] * 2 - b) / w[1]]] as [number, number][];
  return [[(w[1] * 2 - b) / w[0], -2], [(-w[1] * 2 - b) / w[0], 2]] as [number, number][];
}

type Phase = 'neuron' | 'learn' | 'converge' | 'xor' | 'matter' | 'run';

export function PerceptronSection() {
  const [mode, setMode] = useState<'sep' | 'xor'>('sep');
  const modeRef = useRef(mode); modeRef.current = mode;
  const dataRef = useRef(makeSep());
  const w = useRef<[number, number]>([0.6, -0.4]); const bRef = useRef(0); const mis = useRef(99); const ep = useRef(0);
  const [, tick] = useState(0); const frame = useRef(0);
  const reset = (m: 'sep' | 'xor') => { dataRef.current = m === 'sep' ? makeSep() : makeXor(); w.current = [0.6, -0.4]; bRef.current = 0; mis.current = 99; ep.current = 0; };
  useEffect(() => {
    let raf = 0; const loop = () => {
      frame.current++;
      if (frame.current % 10 === 0 && !(modeRef.current === 'sep' && mis.current === 0)) {
        let m = 0; for (const [x, y, label] of dataRef.current) { const out = sign(w.current[0] * x + w.current[1] * y + bRef.current); if (out !== label) { w.current[0] += 0.4 * label * x; w.current[1] += 0.4 * label * y; bRef.current += 0.4 * label; m++; } }
        mis.current = m; ep.current++;
      }
      if (modeRef.current === 'sep' && mis.current === 0 && frame.current % 260 === 0) reset('sep');
      tick((t) => (t + 1) % 100000); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  const toggle = (m: 'sep' | 'xor') => { setMode(m); reset(m); };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Perc phase={key} data={dataRef.current} w={w.current} b={bRef.current} mis={mis.current} ep={ep.current} /> });

  const scenes: StoryScene[] = [
    scene('neuron', 'The first artificial neuron', 'In 1958 the perceptron was the first artificial neuron, and the seed of every neural network. It weights its inputs, sums them, and fires if the total clears a threshold: output = step(w·x + b). Geometrically that’s a line — one class on this side, the other on that side.'),
    scene('learn', 'Learning from its mistakes', 'It learns by a rule so simple it’s almost obvious. Show it a point; if it classifies it wrong, nudge the weights toward getting that point right — which tilts and shifts the dividing line toward the mistake. Sweep through the data, correcting errors, and the line walks across the plane.'),
    scene('converge', 'It provably converges', 'Rosenblatt proved the guarantee: if the two classes CAN be separated by a line, this nudging rule finds a separating line in a finite number of steps — from any starting weights. Watch the boundary swing into place and lock once every point is on its correct side (mistakes → 0).'),
    scene('xor', 'The XOR wall', 'But a single perceptron can only draw one straight line. Give it the XOR pattern — two classes on opposite diagonals — and no line can split them. The learning rule never settles; the boundary thrashes forever. Minsky and Papert’s 1969 proof of this stalled neural networks for over a decade.'),
    scene('matter', 'Why it still matters', 'The escape was to stack perceptrons into layers and train them with backpropagation, letting the network bend the boundary into any shape — even XOR. The single neuron here is exactly one unit of the net in the backprop story; a modern deep network is millions of these weighted-sum-and-threshold units.'),
    { key: 'run', title: 'Watch it learn (or fail)', caption: 'On the separable blobs the boundary swings in and the mistakes drop to zero — it has found a separator, guaranteed. Switch to XOR and watch it thrash: no straight line can ever get all four groups right, so the rule never converges. One neuron, one line — that’s both its power and its limit.', render: () => <Perc phase="run" data={dataRef.current} w={w.current} b={bRef.current} mis={mis.current} ep={ep.current} mode={mode} onMode={toggle} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The <strong>perceptron</strong> (1958) is the original artificial neuron — the seed of every neural network. It multiplies each input by a weight, sums them, and outputs one class if the total clears a threshold and the other if it doesn’t. Geometrically it’s a line (a hyperplane in higher dimensions) splitting the space in two. It learns by a rule so simple it’s almost trivial: whenever it misclassifies a point, nudge the weights toward classifying that point correctly, which tilts the dividing line toward the mistake.</>,
        takeaway: <>A perceptron computes <code>output = step(w·x + b)</code>: a weighted sum of the inputs, thresholded. Training walks through the examples and, for each one it gets wrong, applies <code>w ← w + η·(target − output)·x</code> (and likewise the bias), rotating and shifting the decision line toward the misclassified point. <strong>Rosenblatt’s convergence theorem</strong> guarantees this terminates: if the classes are linearly separable, the rule finds a separating hyperplane in a finite number of updates — bounded by (R/γ)² for data radius R and margin γ — from any starting weights (verified here: it converges in a handful of epochs). The limitation, exposed by Minsky and Papert in 1969, is that a single perceptron draws only a straight boundary, so it cannot represent <strong>XOR</strong> (classes interleaved so no line separates them), and on such data the update never settles (verified). That stalled neural-network research for over a decade — until stacking perceptrons into layers and training with <strong>backpropagation</strong> let networks bend the boundary into any shape. The single neuron here is exactly one unit of the network in the backprop story; scale it to millions of weighted-sum-and-threshold units across many layers and you have a modern deep network.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="pcp-ctl">
          <button type="button" className={`pcp-btn ${mode === 'sep' ? 'on' : ''}`} onClick={() => toggle('sep')}>separable</button>
          <button type="button" className={`pcp-btn ${mode === 'xor' ? 'on' : ''}`} onClick={() => toggle('xor')}>XOR</button>
          <span className="pcp-live">epoch {ep.current} · {mis.current} misclassified{mode === 'sep' && mis.current === 0 ? ' · separated ✓' : mode === 'xor' ? ' · never converges' : ''}</span>
        </div>
      )}
    />
  );
}

const XOR_STATIC = makeXor();
function Perc({ phase, data, w, b, mis, ep, mode, onMode }: { phase: Phase; data: [number, number, number][]; w: [number, number]; b: number; mis: number; ep: number; mode?: 'sep' | 'xor'; onMode?: (m: 'sep' | 'xor') => void }) {
  const on = (p: Phase) => phase === p;
  void onMode;
  const isXor = on('xor') || (on('run') && mode === 'xor');
  // the narrated XOR scene shows a fixed failing line over static XOR data (the live sim runs on the separable set)
  const D = on('xor') ? XOR_STATIC : data;
  const W: [number, number] = on('xor') ? [0, 1] : w;
  const B = on('xor') ? -0.5 : b;
  const misShown = on('xor') ? D.filter((p) => sign(W[0] * p[0] + W[1] * p[1] + B) !== p[2]).length : mis;
  const bl = boundary(W, B);
  return (
    <svg viewBox="0 0 900 420" className="story-svg">
      <text x="60" y="30" className="pcp-col">single neuron: output = step(w·x + b){!on('neuron') ? ` · ${on('xor') ? '' : `epoch ${ep} · `}${misShown} misclassified${mode === 'sep' && mis === 0 ? ' → separated' : isXor ? ' → never 0' : ''}` : ''}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="pcp-frame" />

      {/* decision boundary */}
      <line x1={sx(bl[0][0])} y1={sy(bl[0][1])} x2={sx(bl[1][0])} y2={sy(bl[1][1])} className={`pcp-line ${isXor ? 'fail' : ''}`} />
      {/* weight vector arrow from center */}
      {!on('neuron') && (() => { const wn = Math.hypot(W[0], W[1]) || 1; return <line x1={sx(0.5)} y1={sy(0.5)} x2={sx(0.5) + W[0] / wn * 40} y2={sy(0.5) - W[1] / wn * 40} className="pcp-wvec" markerEnd="url(#pcparr)" />; })()}

      {/* points */}
      {D.map((p, i) => { const out = sign(W[0] * p[0] + W[1] * p[1] + B); const wrong = out !== p[2]; return <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={wrong ? 5 : 3.6} className={`pcp-pt ${p[2] === 1 ? 'pos' : 'neg'} ${wrong ? 'wrong' : ''}`} />; })}

      <defs><marker id="pcparr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="hsl(150 60% 60%)" /></marker></defs>

      <text x="450" y="406" className="pcp-foot" textAnchor="middle">
        {on('neuron') ? 'weighted sum, thresholded → a line dividing the plane in two'
          : on('learn') ? 'each misclassified point nudges the line toward correcting it'
          : on('converge') ? 'linearly separable → the boundary converges (mistakes → 0)'
          : on('xor') ? 'XOR: no single line separates the diagonals → it never converges'
          : on('matter') ? 'stack these neurons + backprop → boundaries of any shape'
          : isXor ? 'XOR: the boundary thrashes — one line can’t do it' : mis === 0 ? 'separated — a line was found, as guaranteed' : 'learning… the boundary is still moving'}
      </text>
    </svg>
  );
}
