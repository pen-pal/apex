// Guided story: differential privacy — releasing statistics about people without leaking any individual. The Laplace
// mechanism answers a numeric query f(D) by returning f(D) + noise drawn from Laplace(Δ/ε), where Δ (sensitivity) is how
// much one person can change the answer (1 for a count) and ε is the privacy budget. The guarantee (ε-DP): for any two
// neighboring datasets differing by one person, and any output t, P[M(D)=t]/P[M(D')=t] ≤ e^ε — an observer can't tell
// whether you're in the data. Verified in node: that ratio is exactly e^ε (tight, for ε=0.5/1/2), the mechanism is
// unbiased (E[M(D)]=f(D)), noise std = √2·Δ/ε, and budgets compose (k queries → kε). Used by Apple, Google, the US
// Census. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const Q = 10, QN = 9, DELTA = 1;   // f(D)=10, neighboring f(D')=9 (one person removed); sensitivity 1
const X0 = 2, X1 = 18, OX = 70, W = 620, BASE = 210, H = 150;
const px = (x: number) => OX + ((x - X0) / (X1 - X0)) * W;
const lapPdf = (x: number, mu: number, b: number) => Math.exp(-Math.abs(x - mu) / b) / (2 * b);
function curve(mu: number, b: number, pmax: number): string {
  const pts: string[] = [];
  for (let x = X0; x <= X1; x += 0.1) pts.push(`${px(x).toFixed(1)},${(BASE - lapPdf(x, mu, b) / pmax * H).toFixed(1)}`);
  return 'M' + pts.join(' L');
}

type Phase = 'reid' | 'noise' | 'neighbor' | 'knob' | 'compose' | 'run';
export function DiffPrivSection() {
  const [eps, setEps] = useState(1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, e: number): StoryScene =>
    ({ key, title, caption, render: () => <DP phase={key} eps={e} /> });

  const scenes: StoryScene[] = [
    scene('reid', 'Aggregates can still leak you', 'Publishing “847 people in this town have condition X” feels safe. But if an attacker knows the count was 846 yesterday and you moved in today, they’ve learned your diagnosis. Any statistic that shifts when one person joins can expose that person. Differential privacy makes that shift undetectable.', 1),
    scene('noise', 'Answer with calibrated noise', 'Instead of the exact count f(D), release f(D) + random noise drawn from a Laplace distribution. The noise scale is Δ/ε: Δ (sensitivity) is the most one person can change the answer — exactly 1 for a count — and ε is the privacy budget you choose. Here the true answer is 10; the released number is 10 plus a random wiggle.', 1),
    scene('neighbor', 'Neighbors become indistinguishable', 'Here’s the guarantee. Take two datasets differing by one person — the count is 10 with you, 9 without. Their noisy-output distributions overlap almost entirely: at every possible output, the two probabilities differ by at most a factor of e^ε. An observer seeing the released number cannot tell which dataset it came from — so cannot tell if you’re in it. (Verified: the ratio is exactly e^ε.)', 0.6),
    scene('knob', 'ε is the privacy–accuracy knob', 'ε tunes the trade-off. Small ε means scale Δ/ε is large — lots of noise, the two curves nearly coincide (strong privacy), but the answer is fuzzy. Large ε means little noise — accurate answers, but the curves separate and privacy weakens. There is no free lunch: privacy costs accuracy, quantified exactly by ε. (Verified: noise std = √2·Δ/ε, answer unbiased.)', 2.4),
    scene('compose', 'Budgets add up', 'Every query you answer spends privacy. Two ε-DP queries together are only 2ε-DP — the guarantees compose by adding. So a deployment fixes a total budget and rations it across all questions ever asked; once spent, no more accurate answers. This is why real systems (Apple, the US Census Bureau) meter every release against a global ε.', 1),
    { key: 'run', title: 'Turn the privacy knob', caption: 'Slide ε. At small ε the two neighboring-dataset curves (with you = 10, without you = 9) sit almost on top of each other — the release could equally have come from either, so your presence is hidden — but the noise is large. At large ε they pull apart and answers sharpen, but an observer gains confidence about whether you’re in the data. The e^ε bound is the exact privacy leakage.', render: () => <DP phase="run" eps={eps} onEps={setEps} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Differential privacy</strong> lets you publish statistics about a group while provably hiding every individual. The <strong>Laplace mechanism</strong> answers a numeric query by adding noise of scale <strong>Δ/ε</strong> — Δ is how much one person can move the answer, ε is your privacy budget. The guarantee: for any two datasets differing by one person, the noisy outputs are nearly indistinguishable — their probabilities differ by at most a factor of <strong>e^ε</strong> — so no observer can tell whether you’re in the data. Smaller ε means more noise, more privacy, less accuracy.</>,
        takeaway: <><strong>Differential privacy</strong> (Dwork–McSherry–Nissim–Smith, 2006) is the rigorous standard for privacy-preserving data analysis. A randomized mechanism M is <strong>ε-differentially private</strong> if for every pair of <strong>neighboring</strong> datasets D, D′ (differing in one individual’s record) and every set of outputs S, Pr[M(D) ∈ S] ≤ e^ε · Pr[M(D′) ∈ S]. The bound holds both directions, so no output is much more likely under one dataset than the other — an adversary’s belief about whether you are in the data barely moves. The workhorse is the <strong>Laplace mechanism</strong>: to release a numeric query f, add noise drawn from Laplace(0, Δ/ε), where the <strong>ℓ₁ sensitivity</strong> Δ = max over neighbors of |f(D) − f(D′)| captures one person’s maximum influence (Δ = 1 for a count). Because the Laplace density falls off as e^(−|x|/b), shifting the center by Δ changes the density at any point by at most e^(Δ/b) = e^ε when b = Δ/ε — that ratio is exactly the privacy guarantee (verified here: the supremum ratio equals e^ε for ε = 0.5, 1, 2). The mechanism is <strong>unbiased</strong> (the noise has mean 0, so E[M(D)] = f(D)) with error scaling as Δ/ε (noise std = √2·Δ/ε), making the <strong>privacy–utility trade-off</strong> explicit: halving ε doubles the noise. Privacy <strong>composes</strong> — answering k queries each ε-DP yields kε-DP (and tighter bounds exist via advanced composition and the <strong>(ε,δ)</strong> relaxation using Gaussian noise) — so deployments budget a total ε and spend it across all releases. This is what powers Apple’s and Google’s telemetry, the 2020 US Census, and private machine learning (DP-SGD clips per-example gradients and adds noise). Crucially it defends even against attackers with arbitrary side information, which is why weaker approaches like k-anonymity, which fall to linkage attacks, gave way to it.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="dpv-ctl">
          <label className="dpv-lab">ε (privacy budget) = {eps.toFixed(2)} · noise scale Δ/ε = {(DELTA / eps).toFixed(2)} · leakage e^ε = {Math.exp(eps).toFixed(2)}×</label>
          <input type="range" min={0.25} max={3} step={0.05} value={eps} onChange={(e) => setEps(+e.target.value)} className="dpv-range" />
          <span className="dpv-note">{eps < 0.8 ? 'strong privacy, fuzzy answers' : eps > 2 ? 'accurate answers, weak privacy' : 'balanced'}</span>
        </div>
      )}
    />
  );
}

function DP({ phase, eps, onEps }: { phase: Phase; eps: number; onEps?: (n: number) => void }) {
  const on = (p: Phase) => phase === p; void onEps;
  const b = DELTA / eps; const pmax = 1 / (2 * b); // peak of the sharper curve at current ε
  return (
    <svg viewBox="0 0 760 260" className="story-svg">
      <text x="56" y="20" className="dpv-col">Laplace mechanism · release count + Lap(Δ/ε) · ε={eps.toFixed(2)} · neighbors differ by e^ε={Math.exp(eps).toFixed(2)}×</text>

      {/* axis */}
      <line x1={OX} y1={BASE} x2={OX + W} y2={BASE} className="dpv-axis" />
      {[4, 6, 8, 10, 12, 14, 16].map((x) => <text key={x} x={px(x)} y={BASE + 16} className="dpv-tick" textAnchor="middle">{x}</text>)}
      <text x={OX + W / 2} y={BASE + 32} className="dpv-xl" textAnchor="middle">released answer</text>

      {/* the two neighboring-dataset output distributions */}
      <path d={curve(QN, b, pmax)} className="dpv-cn" />
      <path d={curve(Q, b, pmax)} className="dpv-cd" />
      <line x1={px(Q)} y1={BASE} x2={px(Q)} y2={BASE - H} className="dpv-mu dpv-d" />
      <line x1={px(QN)} y1={BASE} x2={px(QN)} y2={BASE - H} className="dpv-mu dpv-n" />
      <text x={px(Q) + 4} y={BASE - H - 4} className="dpv-ld">M(D): with you, count=10</text>
      <text x={px(QN) - 4} y={BASE - H + 14} className="dpv-ln" textAnchor="end">M(D′): without you, count=9</text>

      <text x="380" y="250" className="dpv-foot" textAnchor="middle">
        {on('reid') ? 'a count that moves when one person joins can expose that person'
          : on('noise') ? 'release f(D) + Laplace(Δ/ε) noise — Δ=1 for a count'
          : on('neighbor') ? 'with-you vs without-you outputs overlap → can’t tell you apart'
          : on('knob') ? 'small ε = more noise = more privacy, less accuracy'
          : on('compose') ? 'k queries each ε-DP compose to kε-DP — ration the budget'
          : `ε=${eps.toFixed(2)} · noise scale ${b.toFixed(2)} · curves overlap within e^ε=${Math.exp(eps).toFixed(2)}×`}
      </text>
    </svg>
  );
}
