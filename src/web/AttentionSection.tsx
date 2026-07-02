// Guided story: how attention works — the core of every transformer / LLM. Each token emits a query, a key, and a
// value; a token attends to another by how well its query matches that key (a dot product), the scores are scaled and
// softmaxed into weights that sum to 1, and the token's new representation is the weighted blend of everyone's values.
// Real scaled dot-product attention over a 6-token toy with 2D semantic vectors (verified in node: softmax sums to 1,
// output is a convex blend; "river" attends to the water cluster, "money" to finance, ambiguous "bank" to both).
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const TOK = ['river', 'water', 'flows', 'bank', 'money', 'loan'];
// 2D semantic space: [water-axis, finance-axis] — two clusters, "bank" sits between them
const E: Record<string, [number, number]> = { river: [3.0, 0.0], water: [3.0, 0.3], flows: [2.6, 0.1], bank: [1.6, 1.6], money: [0.0, 3.0], loan: [0.2, 2.7] };
const VEC = TOK.map((t) => E[t]); const D = 2;
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1];
function attend(qi: number) {
  const q = E[TOK[qi]];
  const scores = TOK.map((t) => dot(q, E[t]) / Math.sqrt(D));
  const m = Math.max(...scores); const ex = scores.map((s) => Math.exp(s - m)); const Z = ex.reduce((a, b) => a + b, 0);
  const w = ex.map((e) => e / Z);
  const out: [number, number] = [w.reduce((s, wi, j) => s + wi * VEC[j][0], 0), w.reduce((s, wi, j) => s + wi * VEC[j][1], 0)];
  return { scores, w, out };
}

type Phase = 'context' | 'qkv' | 'softmax' | 'blend' | 'scale' | 'run';

export function AttentionSection() {
  const [qi, setQi] = useState(3); // 'bank'
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, q: number): StoryScene =>
    ({ key, title, caption, render: () => <Att phase={key} qi={q} /> });

  const scenes: StoryScene[] = [
    scene('context', 'Context decides meaning', '“bank” means different things next to “river” and next to “money.” A model can’t read a word in isolation. Attention is how each token looks at every other token in the sequence and pulls in whatever is relevant to it.', 3),
    scene('qkv', 'Query, key, value', 'Every token emits three vectors: a query (what am I looking for?), a key (what do I offer?), and a value (what I’ll contribute). To decide how much one token attends to another, dot the first token’s query with the second’s key — a big dot product means “relevant to me.”', 0),
    scene('softmax', 'Scores → softmax → weights', 'Each query is dotted with every key to give a score, scaled by √(key size) to keep the numbers tame. Softmax then exponentiates and normalizes the scores into attention weights that are all positive and sum to exactly 1 — a distribution over where this token should look.', 4),
    scene('blend', 'The output is a weighted blend', 'Multiply each token’s value by its attention weight and add them up. The token’s new representation is a blend of everyone’s values, dominated by the ones it found relevant — so “river” comes out near the water cluster, “money” near finance, each now carrying its context.', 0),
    scene('scale', 'Ambiguous words split their attention', '“bank” sits between the water and finance clusters, so its query matches keys on both sides and its attention spreads across them — it literally hasn’t decided yet. Stack more layers and heads and later ones sharpen it using the rest of the sentence. This is one attention head; a transformer runs many, over many layers, every token in parallel.', 3),
    { key: 'run', title: 'Pick the token that’s looking', caption: 'Choose which token is the query and watch its attention weights over all six tokens — always summing to 1 — and the blended output vector. “river” locks onto the water words, “money” onto the finance words, and “bank,” being between them, attends to both. The same operation, scaled to thousands of tokens and billions of weights, is the core of every LLM.', render: () => <Att phase="run" qi={qi} onPick={setQi} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To understand a word you need its context — “bank” means different things next to “river” and “money.” Attention is how a transformer lets each token look at all the others and pull in what’s relevant. Every token emits a <strong>query</strong> (what it’s looking for), a <strong>key</strong> (what it offers), and a <strong>value</strong> (what it contributes); a token attends to another by how well its query matches that key, and its new representation becomes a weighted blend of the others’ values.</>,
        takeaway: <>For each token, its query is dotted with every token’s key to give a relevance score; the scores are scaled by √(key dimension) and passed through <strong>softmax</strong>, which exponentiates and normalizes them into weights that are all positive and <strong>sum to 1</strong> — a distribution over where to look. The output for that token is the weighted sum of all the value vectors under those weights, so it’s a convex blend dominated by the tokens it found most relevant. That’s a single attention head; a transformer stacks many heads (each learning a different relation — syntax, coreference, topic) across many layers, and because every token’s attention is computed independently, the whole sequence processes <em>in parallel</em> on a GPU. That parallelism, plus attention’s ability to connect any two positions in a single step, is why transformers replaced RNNs and scale to the billions of parameters behind modern LLMs.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="att-ctl">
          <span className="att-ctllbl">query token:</span>
          {TOK.map((t, i) => <button key={t} type="button" className={`att-pick ${qi === i ? 'on' : ''}`} onClick={() => setQi(i)}>{t}</button>)}
        </div>
      )}
    />
  );
}

function Att({ phase, qi, onPick }: { phase: Phase; qi: number; onPick?: (i: number) => void }) {
  const on = (p: Phase) => phase === p;
  const { scores, w, out } = attend(qi);
  const x = (i: number) => 80 + i * 128; const yTok = 150;
  const showW = on('softmax') || on('blend') || on('scale') || on('run');
  const showArrows = on('context') || on('blend') || on('scale') || on('run');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="40" className="att-col">6 tokens · query = “{TOK[qi]}” · scaled dot-product attention</text>

      {/* query marker */}
      <text x={x(qi)} y={yTok - 52} className="att-qlbl" textAnchor="middle">query</text>
      <line x1={x(qi)} y1={yTok - 44} x2={x(qi)} y2={yTok - 26} className="att-qarrow" />

      {/* tokens */}
      {TOK.map((t, i) => {
        const isQ = i === qi;
        return (
          <g key={t} onClick={onPick ? () => onPick(i) : undefined} style={{ cursor: onPick ? 'pointer' : 'default' }}>
            <rect x={x(i) - 52} y={yTok - 22} width="104" height="44" rx="8" className={`att-tok ${isQ ? 'q' : ''}`} />
            <text x={x(i)} y={yTok + 5} className="att-tokt" textAnchor="middle">{t}</text>
            {/* attention weight bar */}
            {showW && <>
              <rect x={x(i) - 30} y={yTok + 60} width="60" height="120" rx="3" className="att-barbg" />
              <rect x={x(i) - 30} y={yTok + 60 + 120 * (1 - w[i])} width="60" height={120 * w[i]} rx="3" className={`att-bar ${isQ ? 'q' : ''}`} />
              <text x={x(i)} y={yTok + 200} className="att-wt" textAnchor="middle">{(w[i] * 100).toFixed(0)}%</text>
            </>}
            {on('qkv') && <text x={x(i)} y={yTok + 44} className="att-kv" textAnchor="middle">K=[{E[t][0]},{E[t][1]}]</text>}
            {on('softmax') && <text x={x(i)} y={yTok + 44} className="att-kv" textAnchor="middle">{scores[i].toFixed(2)}</text>}
          </g>
        );
      })}

      {/* arrows from query to each token, thickness ∝ weight */}
      {showArrows && TOK.map((_t, i) => i !== qi && (
        <path key={'a' + i} d={`M ${x(qi)} ${yTok + 26} Q ${(x(qi) + x(i)) / 2} ${yTok + 70} ${x(i)} ${yTok + 26}`} className="att-flow" fill="none" strokeWidth={Math.max(0.5, w[i] * 14)} opacity={0.25 + w[i] * 2} />
      ))}

      {(on('blend') || on('scale') || on('run')) && <text x="450" y={yTok + 232} className="att-out" textAnchor="middle">output = Σ weightᵢ · valueᵢ = [{out[0].toFixed(2)}, {out[1].toFixed(2)}]  ({out[0] > out[1] ? 'water-leaning' : out[1] > out[0] ? 'finance-leaning' : 'balanced'})</text>}

      <text x="450" y="452" className="att-foot" textAnchor="middle">
        {on('context') ? 'each token looks at every other and pulls in what’s relevant'
          : on('qkv') ? 'attention(A→B) = query(A) · key(B): how relevant B is to A'
          : on('softmax') ? 'scores ÷ √d → softmax → weights, all positive, summing to 1'
          : on('blend') ? 'new representation = weighted sum of every token’s value vector'
          : on('scale') ? '“bank” matches both clusters → its attention splits between them'
          : 'weights always sum to 1 · click a token to make it the query'}
      </text>
    </svg>
  );
}
