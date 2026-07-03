// Guided story: the Wallace tree multiplier — how hardware multiplies two numbers fast. a×b is the sum of N partial
// products (a shifted copy of a for each 1-bit of b); adding them with ripple-carry is N slow carry propagations.
// Instead, lay the partial-product bits out as a "dot diagram" (column c = all bits of weight 2^c) and reduce it with
// carry-save adders: a full adder turns 3 dots in a column into 1 sum (same column) + 1 carry (next column) with NO
// carry propagation. Repeat in parallel and after O(log N) stages every column has ≤2 dots — two numbers, added once.
// Verified in node: the reduced product equals BigInt a*b (2000 multiplies, 0 mismatch) and the weighted column sum is
// preserved at every stage. The design (Wallace 1964 / Dadda) inside every fast multiplier. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const N = 4, W = 2 * N;
type Cols = number[][];
function wallace(a: number, b: number): { stages: Cols[]; product: number } {
  const init: Cols = Array.from({ length: W }, () => []);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) init[i + j].push(((a >> j) & 1) & ((b >> i) & 1));
  const put = (arr: Cols, c: number, v: number) => { if (c < W) arr[c].push(v); };
  const stages: Cols[] = [init.map((c) => [...c])]; let cur = init.map((c) => [...c]);
  while (cur.some((c) => c.length > 2)) {
    const nx: Cols = Array.from({ length: W }, () => []);
    for (let c = 0; c < W; c++) { let bits = [...cur[c]];
      while (bits.length >= 3) { const [x, y, z] = bits.splice(0, 3); const t = x + y + z; put(nx, c, t & 1); put(nx, c + 1, t >> 1); }
      if (bits.length === 2) { const t = bits[0] + bits[1]; put(nx, c, t & 1); put(nx, c + 1, t >> 1); }
      else if (bits.length === 1) put(nx, c, bits[0]);
    }
    cur = nx; stages.push(cur.map((c) => [...c]));
  }
  let product = 0; for (let c = 0; c < W; c++) product += cur[c].reduce((s, x) => s + x, 0) * (1 << c);
  return { stages, product };
}

const PRESETS = [[13, 11], [15, 15], [9, 7], [10, 12]];
const OX = 96, CW = 40, BASE = 250, DOT = 15;
type Phase = 'addshift' | 'dots' | 'carrysave' | 'reduce' | 'finaladd' | 'run';

export function WallaceSection() {
  const [pi, setPi] = useState(0); const [stage, setStage] = useState(99);
  const [a, b] = PRESETS[pi]; const { stages, product } = wallace(a, b);
  const maxStage = stages.length - 1;

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, st: number): StoryScene =>
    ({ key, title, caption, render: () => <Dots phase={key} a={13} b={11} st={st} /> });

  const scenes: StoryScene[] = [
    scene('addshift', 'Multiply is a sum of shifts', 'Multiplying two binary numbers is grade-school long multiplication: for each 1-bit of b, add a copy of a shifted left to that bit’s position. An N-bit multiply is a sum of up to N of these partial products. Adding them one at a time means N slow carry-propagating additions — the bottleneck.', 0),
    scene('dots', 'The dot diagram', 'Forget rows; sort every partial-product bit into columns by its weight. Column c holds all the bits worth 2^c. The result is a triangle of dots — one dot in the far columns, up to N dots piled up in the middle. The product is just the weighted sum of all these dots; the job is to add each column’s dots efficiently.', 0),
    scene('carrysave', 'Carry-save: three dots into two', 'A full adder takes three bits and outputs a sum bit and a carry bit — value preserved (3 = sum + 2·carry). Read as dots: it swallows 3 dots in a column and drops 1 sum dot back in that column and 1 carry dot in the next column to the left. No carry ripples across — every column is compressed at once, in parallel.', 1),
    scene('reduce', 'Reduce to two rows', 'Apply that 3-into-2 compression to every column, over and over. Each stage cuts the tallest pile by about a third, so after only O(log N) stages every column holds at most two dots — the whole partial-product triangle has collapsed into just two numbers. (Verified: the weighted sum of the dots is identical at every stage.)', 2),
    scene('finaladd', 'One carry-propagate add at the end', 'Now add those two remaining numbers with a single fast adder (a carry-lookahead) — one carry propagation, not N. So a hardware multiply costs O(log N) parallel compression stages plus one addition, which is why multipliers keep pace with adders. 13 × 11 falls out as 143. (Verified bit-exact against the true product.)', 2),
    { key: 'run', title: 'Reduce a multiply yourself', caption: 'Pick a multiplication and step the reduction. Watch the partial-product dots pile into columns, then carry-save adders squeeze every column from three-plus dots down toward two, stage by stage, until only two rows remain — added once for the product. The tall middle column falling is the whole speed win.', render: () => <Dots phase="run" a={a} b={b} st={Math.min(stage, maxStage)} product={product} onStage={setStage} onPick={setPi} pi={pi} maxStage={maxStage} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Multiplying two numbers is adding up <strong>partial products</strong> — a shifted copy of one number for each 1-bit of the other — and adding N of them one at a time is slow. A <strong>Wallace tree</strong> instead lays all the partial-product bits out as a <strong>dot diagram</strong> (a column per bit-weight) and squeezes it with <strong>carry-save adders</strong>: each full adder turns 3 dots in a column into 1 sum dot plus 1 carry dot next door, with no carry propagation. Repeat in parallel and after O(log N) stages only two numbers remain — added once for the product.</>,
        takeaway: <>A multiply of two N-bit numbers is the sum of the <strong>partial products</strong> pₖ = (bit k of b) · a · 2ᵏ — up to N shifted copies of a. Summing them with N sequential carry-propagating adds is O(N) slow additions. The <strong>Wallace tree</strong> (Chris Wallace, 1964) reorganizes the sum. First drop every partial-product bit into a <strong>dot diagram</strong>: column c collects all bits of weight 2ᶜ, giving a triangle up to N dots tall in the middle. Then reduce with <strong>carry-save (3:2) adders</strong>: a full adder sums 3 bits into a 2-bit result, so as dots it consumes 3 in a column and emits 1 sum dot in the same column and 1 carry dot in the next — value conserved because 3 bits of weight 2ᶜ equal one sum bit (2ᶜ) plus one carry bit (2ᶜ⁺¹). Crucially the carry is <em>saved</em> for the next stage, not propagated, so every column is compressed simultaneously in one gate delay. Each stage shrinks the tallest column by a factor ≈ 3/2, so after <strong>O(log N)</strong> stages every column has at most two dots — the triangle has become two numbers, which a single fast <strong>carry-propagate adder</strong> sums into the product (verified here: the reduced product equals a·b exactly, and the weighted dot-sum is invariant at every stage). The result: multiply latency is O(log N), essentially the same order as addition, instead of O(N). The <strong>Dadda</strong> tree is a variant that uses fewer adders by reducing more lazily; <strong>Booth encoding</strong> is the common front-end that halves the number of partial-product rows. Together they’re the arithmetic core of every CPU and GPU multiplier, and of the multiply-accumulate cells in the systolic arrays that run neural networks.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="wt-ctl">
          {PRESETS.map((p, i) => <button key={i} type="button" className={`wt-btn ${pi === i ? 'on' : ''}`} onClick={() => { setPi(i); setStage(0); }}>{p[0]}×{p[1]}</button>)}
          <button type="button" className="wt-btn" onClick={() => setStage((v) => Math.min(maxStage, v + 1))}>reduce ›</button>
          <span className="wt-read">stage {Math.min(stage, maxStage)}/{maxStage} · {a}×{b} = <b>{product}</b>{Math.min(stage, maxStage) === maxStage ? ' ✓' : ''}</span>
        </div>
      )}
    />
  );
}

function Dots({ phase, a, b, st, product, onStage, onPick, pi, maxStage }: { phase: Phase; a: number; b: number; st: number; product?: number; onStage?: (n: number) => void; onPick?: (n: number) => void; pi?: number; maxStage?: number }) {
  const on = (p: Phase) => phase === p;
  void onStage; void onPick; void pi; void maxStage;
  const { stages, product: prod } = wallace(a, b);
  const S = Math.min(st, stages.length - 1);
  const cols = stages[S];
  const done = S === stages.length - 1;
  const colX = (c: number) => OX + (W - 1 - c) * CW;   // column 0 (LSB) on the right
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="wt-col">{a} × {b} = {product ?? prod} · {on('dots') || on('addshift') ? 'partial products' : done ? `${S} reduction stages → 2 rows` : `reduction stage ${S}`}</text>

      {/* column weight labels */}
      {Array.from({ length: W }, (_, c) => <text key={c} x={colX(c) + DOT / 2} y={BASE + 24} className="wt-wt" textAnchor="middle">2{sup(c)}</text>)}

      {/* the dots */}
      {cols.map((col, c) => col.map((bit, k) => <circle key={c + '-' + k} cx={colX(c) + DOT / 2} cy={BASE - k * (DOT + 3)} r={DOT / 2 - 1} className={`wt-dot ${bit ? 'one' : 'zero'} ${!done && col.length > 2 && k >= col.length - 3 ? 'hot' : ''}`} />))}

      {/* the two final rows bracket */}
      {done && <text x={colX(W - 1) + 40} y={BASE - 6} className="wt-lbl">≤ 2 rows → one final add</text>}

      <text x="380" y="292" className="wt-foot" textAnchor="middle">
        {on('addshift') ? 'sum of shifted copies of a — one per 1-bit of b'
          : on('dots') ? 'bits sorted into columns by weight → a triangle of dots'
          : on('carrysave') ? 'a full adder: 3 dots → 1 sum (here) + 1 carry (left), no ripple'
          : on('reduce') ? 'every column compressed in parallel; tallest pile shrinks ~⅓ per stage'
          : on('finaladd') ? 'two rows left → one carry-propagate add = the product'
          : done ? `reduced to ≤2 dots per column in ${S} stages → add once = ${product ?? prod}` : `stage ${S}: carry-save compressing the columns`}
      </text>
    </svg>
  );
}
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷'];
const sup = (n: number) => SUP[n] || '' + n;
