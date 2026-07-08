// Mixture of Experts, made visible. A token is scored by the router against N experts; only the top-k run, weighted by
// a softmax gate — so the model has N experts' parameters but spends only k per token. Pick the token and top-k and
// watch which experts activate and how sparse the compute is; then a batch view shows a balanced router spreading load
// vs a skewed one hogging a few experts. Model + tests in moe.ts.
import { useMemo, useState } from 'react';
import { topK, gateWeights, sparsity, imbalance } from './moe';

const N = 8;
const EXPERT_B = 7; // 7B params per expert → an "8×7B" MoE, like Mixtral
// Router scores for three tokens (one 8-vector each) — different tokens prefer different experts.
const TOKENS: { label: string; scores: number[] }[] = [
  { label: '“ photosynthesis ”', scores: [0.2, 0.1, 0.9, 0.3, 0.15, 0.7, 0.25, 0.1] },
  { label: '“ def ”',            scores: [0.8, 0.75, 0.1, 0.2, 0.6, 0.15, 0.1, 0.2] },
  { label: '“ 你好 ”',           scores: [0.1, 0.2, 0.15, 0.85, 0.2, 0.1, 0.35, 0.78] },
];
// Per-expert token counts over a 64-token batch, for two routers.
const ROUTERS: Record<string, number[]> = {
  balanced: [16, 17, 15, 16, 17, 15, 16, 16],
  skewed: [41, 33, 22, 12, 8, 6, 4, 2],
};

export function MoeSection() {
  const [tok, setTok] = useState(0);
  const [k, setK] = useState(2);
  const [skewed, setSkewed] = useState(false);

  const scores = TOKENS[tok].scores;
  const selected = useMemo(() => topK(scores, k), [scores, k]);
  const weights = useMemo(() => gateWeights(scores, selected), [scores, selected]);
  const wOf = (e: number) => { const i = selected.indexOf(e); return i < 0 ? 0 : weights[i]; };
  const sp = sparsity(N, k, EXPERT_B);
  const loads = ROUTERS[skewed ? 'skewed' : 'balanced'];
  const imb = imbalance(loads);
  const maxLoad = Math.max(...loads);

  return (
    <div className="moe">
      <div className="moe-controls">
        <div className="moe-seg"><span>token</span>{TOKENS.map((t, i) => <button key={t.label} type="button" className={tok === i ? 'on' : ''} onClick={() => setTok(i)}>{t.label}</button>)}</div>
        <label className="moe-slider"><span>top-k experts&nbsp;<b>{k}</b></span><input type="range" min={1} max={4} value={k} onChange={(e) => setK(+e.target.value)} /></label>
      </div>

      <div className="moe-experts">
        <div className="moe-lbl">the router scores all {N} experts; the top-{k} run (highlighted), the rest stay idle</div>
        <div className="moe-grid">
          {scores.map((s, e) => {
            const active = selected.includes(e);
            return (
              <div key={e} className={`moe-exp ${active ? 'moe-on' : 'moe-off'}`}>
                <div className="moe-exp-h">expert {e}</div>
                <div className="moe-score"><div className="moe-score-fill" style={{ width: `${s * 100}%` }} /></div>
                {active ? <div className="moe-weight">gate {Math.round(wOf(e) * 100)}%</div> : <div className="moe-idle">idle</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="moe-sparsity">
        <b>{sp.activeB}B</b> active of <b>{sp.totalB}B</b> total — only <b>{sp.pct}%</b> of the feed-forward parameters run for this token.
        The model <em>knows</em> {sp.totalB}B worth, but each token pays for {sp.activeB}B. That decoupling of capacity from compute is the whole point of MoE.
      </div>

      <div className="moe-batch">
        <div className="moe-batch-h">
          <span className="moe-lbl">over a 64-token batch, how evenly does the router spread load?</span>
          <label className="moe-tog"><input type="checkbox" checked={skewed} onChange={(e) => setSkewed(e.target.checked)} /> use a skewed router (no balancing loss)</label>
        </div>
        <div className="moe-loads">
          {loads.map((l, e) => (
            <div key={e} className="moe-load"><div className={`moe-load-bar ${skewed && l === maxLoad ? 'moe-hot' : ''}`} style={{ height: `${(l / maxLoad) * 100}%` }} /><span>e{e}</span></div>
          ))}
        </div>
        <div className={`moe-verdict ${imb < 1.5 ? 'moe-ok' : 'moe-bad'}`}>
          {imb < 1.5
            ? <>Balanced (imbalance {imb.toFixed(2)}×) — every expert does its share, so all the parameters earn their place.</>
            : <>Imbalanced (imbalance {imb.toFixed(2)}×) — a few experts get most tokens (a bottleneck) while the rest sit idle (wasted parameters). This is why MoE training adds an <strong>auxiliary load-balancing loss</strong> that nudges the router to spread tokens out.</>}
        </div>
      </div>

      <p className="moe-foot">
        A dense transformer runs its whole feed-forward network on every token; an <strong>MoE</strong> swaps that for many
        experts and a router that picks a few. Because only <em>k</em> of <em>N</em> run, you can grow N — and the model’s
        total knowledge — almost for free in FLOPs, which is how “8×7B” and trillion-parameter models train and serve at
        the cost of far smaller dense ones. The costs are real: all N experts must sit in memory even though most are idle,
        and routing has to stay balanced or capacity is wasted. Top-k is the knob between them — k=1 (switch routing) is
        cheapest, larger k blends more experts per token for quality. (Sparse MoE; Shazeer 2017, Mixtral, DeepSeek-MoE.)
      </p>
    </div>
  );
}
