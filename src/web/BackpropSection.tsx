// Guided story: how a neural network learns — backpropagation. A net is a function with weight "knobs"; training finds
// the knobs that make the output match the target. The loss is a function of every weight, and backprop computes its
// gradient (∂loss/∂weight) for ALL weights in ONE backward sweep via the chain rule, reusing the forward values — so
// all gradients cost about one forward pass, which is why training huge nets is feasible. Real 2-2-1 sigmoid net,
// verified in node by a GRADIENT CHECK: analytic backprop matches finite-difference to 5 digits. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const X = [0.05, 0.10], Y = 0.9;
type P = { W1: number[][]; b1: number[]; W2: number[]; b2: number };
const INIT: P = { W1: [[0.15, 0.2], [0.25, 0.3]], b1: [0.35, 0.35], W2: [0.4, 0.45], b2: 0.6 };

function forward(P: P) {
  const z1 = [P.W1[0][0] * X[0] + P.W1[0][1] * X[1] + P.b1[0], P.W1[1][0] * X[0] + P.W1[1][1] * X[1] + P.b1[1]];
  const h = [sig(z1[0]), sig(z1[1])];
  const o = sig(P.W2[0] * h[0] + P.W2[1] * h[1] + P.b2);
  return { h, o, loss: 0.5 * (o - Y) ** 2 };
}
function backprop(P: P) {
  const { h, o } = forward(P);
  const dz2 = (o - Y) * o * (1 - o);
  const dW2 = [dz2 * h[0], dz2 * h[1]];
  const dz1 = [dz2 * P.W2[0] * h[0] * (1 - h[0]), dz2 * P.W2[1] * h[1] * (1 - h[1])];
  const dW1 = [[dz1[0] * X[0], dz1[0] * X[1]], [dz1[1] * X[0], dz1[1] * X[1]]];
  return { dz1, dz2, dW2, db2: dz2, dW1, db1: dz1 };
}
function step(P: P, lr: number): P {
  const g = backprop(P);
  return {
    W1: [[P.W1[0][0] - lr * g.dW1[0][0], P.W1[0][1] - lr * g.dW1[0][1]], [P.W1[1][0] - lr * g.dW1[1][0], P.W1[1][1] - lr * g.dW1[1][1]]],
    b1: [P.b1[0] - lr * g.db1[0], P.b1[1] - lr * g.db1[1]],
    W2: [P.W2[0] - lr * g.dW2[0], P.W2[1] - lr * g.dW2[1]], b2: P.b2 - lr * g.db2,
  };
}

type Phase = 'knobs' | 'forward' | 'gradient' | 'backward' | 'descend' | 'run';

export function BackpropSection() {
  const [P, setP] = useState<P>(INIT);
  const [hist, setHist] = useState<number[]>([forward(INIT).loss]);
  const train = (n: number) => { let p = P; const h = [...hist]; for (let i = 0; i < n; i++) { p = step(p, 6); h.push(forward(p).loss); } setP(p); setHist(h.slice(-60)); };
  const reset = () => { setP(INIT); setHist([forward(INIT).loss]); };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Net phase={key} P={INIT} hist={[forward(INIT).loss]} /> });

  const scenes: StoryScene[] = [
    scene('knobs', 'A net is a function with knobs', 'A neural network is one big function from inputs to an output, with a pile of weights as tunable knobs. Training means finding the knob settings that make the output match the target. With millions of knobs, the question is: which way do you turn each one?'),
    scene('forward', 'Forward pass → a prediction', 'Feed the inputs through: each neuron sums its weighted inputs, squashes the sum with a nonlinearity (here a sigmoid), and passes it on. Out comes a prediction — and a loss measuring how far it is from the target.'),
    scene('gradient', 'The gradient points downhill', 'The loss is a function of every weight. Its gradient — the partial derivative ∂loss/∂weight for each one — is the slope in that weight’s direction; step the opposite way and the loss falls. But computing each of a million derivatives separately, by nudging one weight at a time, would be hopeless.'),
    scene('backward', 'Backprop = chain rule, backward', 'Backpropagation gets every gradient in ONE backward sweep. Start with ∂loss/∂output, then apply the chain rule layer by layer moving back: each neuron multiplies the gradient arriving from above by its own local derivative and hands the result to the layer below. Reusing the forward values, all the gradients together cost about one forward pass.'),
    scene('descend', 'Step downhill, repeat', 'Nudge every weight a little against its gradient — gradient descent — and the loss drops. Repeat over many examples and the network learns. A gradient check confirms the derivatives: backprop’s gradient matches a brute-force estimate (perturb a weight, watch the loss move) to five digits.'),
    { key: 'run', title: 'Train it', caption: 'Press train and watch the loss fall as gradient descent nudges the weights down their gradients, forward-and-backward pass after pass. The network is fitting its target — the same loop, scaled to billions of weights and oceans of data, is how every model you’ve used was trained.', render: () => <Net phase="run" P={P} hist={hist} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A neural network is just a big function from inputs to an output, with a pile of weights as tunable knobs; training means finding the settings that make its output match the target. The question is which way to turn each knob. The <strong>loss</strong> (how wrong the output is) is a function of every weight, and its <strong>gradient</strong> — the slope in each weight’s direction — says which way is downhill. Backpropagation is how you compute that gradient for every weight at once, efficiently, with the chain rule.</>,
        takeaway: <>The forward pass runs the inputs through the layers to a prediction and a loss. Backprop then computes <code>∂loss/∂weight</code> for every weight in a single <strong>backward sweep</strong>: it starts with the derivative of the loss w.r.t. the output and applies the <strong>chain rule</strong> layer by layer moving backward — at each step multiplying by that layer’s local derivative and passing the accumulated gradient down. Because it reuses the values already computed going forward, getting <em>all</em> the gradients costs about one forward pass — not one pass per weight — which is the only reason training billion-parameter networks is feasible. Then gradient descent nudges each weight a small step against its gradient, the loss drops, and repeating over many examples is learning. You verify it with a <strong>gradient check</strong>: the analytic backprop gradient matches a brute-force finite-difference estimate — here to five digits.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="nn-ctl">
          <button type="button" className="nn-btn" onClick={() => train(1)}>train 1 step</button>
          <button type="button" className="nn-btn" onClick={() => train(25)}>train 25</button>
          <button type="button" className="nn-btn ghost" onClick={reset}>reset</button>
          <span className="nn-live">loss {forward(P).loss.toFixed(5)} · output {forward(P).o.toFixed(3)} → target {Y}</span>
        </div>
      )}
    />
  );
}

function Net({ phase, P, hist }: { phase: Phase; P: P; hist: number[] }) {
  const on = (p: Phase) => phase === p;
  const { h, o, loss } = forward(P);
  const g = backprop(P);
  const showFwd = !on('knobs');
  const showBack = on('backward') || on('descend') || on('run');
  const inN = [{ x: 120, y: 170, v: X[0] }, { x: 120, y: 300, v: X[1] }];
  const hN = [{ x: 430, y: 170, v: h[0], d: g.dz1[0] }, { x: 430, y: 300, v: h[1], d: g.dz1[1] }];
  const oN = { x: 720, y: 235, v: o, d: g.dz2 };
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, key: string) =>
    <line key={key} x1={a.x + 26} y1={a.y} x2={b.x - 26} y2={b.y} className="nn-edge" strokeWidth={Math.min(6, 1 + Math.abs(w) * 3)} opacity={0.35 + Math.min(0.55, Math.abs(w) * 0.4)} />;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="40" className="nn-col">2 → 2 → 1 sigmoid network — forward values in blue{showBack ? ', backward gradients in orange' : ''}</text>
      {/* edges */}
      {inN.map((a, i) => hN.map((b, j) => edge(a, b, P.W1[j][i], `e1${i}${j}`)))}
      {hN.map((a, j) => edge(a, oN, P.W2[j], `e2${j}`))}
      {/* nodes */}
      {inN.map((n, i) => <g key={'in' + i}><circle cx={n.x} cy={n.y} r="26" className="nn-node in" /><text x={n.x} y={n.y + 5} className="nn-val" textAnchor="middle">{n.v.toFixed(2)}</text><text x={n.x - 44} y={n.y + 5} className="nn-nlbl" textAnchor="middle">x{i + 1}</text></g>)}
      {hN.map((n, j) => <g key={'h' + j}><circle cx={n.x} cy={n.y} r="26" className="nn-node" /><text x={n.x} y={n.y + 5} className="nn-val" textAnchor="middle">{showFwd ? n.v.toFixed(2) : 'h'}</text>{showBack && <text x={n.x} y={n.y + 46} className="nn-grad" textAnchor="middle">δ {n.d.toExponential(1)}</text>}</g>)}
      <g><circle cx={oN.x} cy={oN.y} r="30" className="nn-node out" /><text x={oN.x} y={oN.y + 5} className="nn-val" textAnchor="middle">{showFwd ? o.toFixed(3) : 'o'}</text>{showBack && <text x={oN.x} y={oN.y + 50} className="nn-grad" textAnchor="middle">δ {g.dz2.toExponential(1)}</text>}<text x={oN.x} y={oN.y - 42} className="nn-nlbl" textAnchor="middle">output</text></g>

      {showFwd && <text x={oN.x + 44} y={oN.y + 5} className="nn-target">target {Y}</text>}
      {showBack && <text x="450" y="90" className="nn-flow" textAnchor="middle">← gradient flows back: ∂loss/∂o → ∂loss/∂h → ∂loss/∂weights</text>}

      {/* loss + sparkline */}
      <text x="60" y="392" className="nn-loss">loss {loss.toFixed(5)}</text>
      {(on('descend') || on('run')) && hist.length > 1 && (() => {
        const max = Math.max(...hist), min = Math.min(...hist), W = 300, H = 54, ox = 220, oy = 350;
        const pts = hist.map((l, i) => `${ox + (i / (hist.length - 1)) * W},${oy + H - (max === min ? 0 : (l - min) / (max - min)) * H}`);
        return <g><polyline points={pts.join(' ')} className="nn-spark" fill="none" /><text x={ox} y={oy - 6} className="nn-sparklbl">loss over training steps ↓</text></g>;
      })()}

      <text x="450" y="452" className="nn-foot" textAnchor="middle">
        {on('knobs') ? 'find the weights that make output match target — which way to turn each?'
          : on('forward') ? 'weighted sum → sigmoid → pass on; out comes a prediction and a loss'
          : on('gradient') ? '∂loss/∂weight is the slope; step against it to lower the loss'
          : on('backward') ? 'one backward pass, chain rule per layer, computes every gradient at once'
          : on('descend') ? 'weights -= lr · gradient; loss falls; repeat = learning'
          : `loss ${loss.toFixed(5)} — training nudges every weight down its gradient`}
      </text>
    </svg>
  );
}
