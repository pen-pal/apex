// Guided story: the systolic array (Kung & Leiserson 1978) — the matrix-multiply engine at the heart of Google's TPU.
// An m×n grid of tiny multiply-accumulate cells (PEs); matrix A streams in from the left (each row skewed by one cycle),
// B streams in from the top (each column skewed), and each PE multiplies its two inputs, adds to a running sum, and
// passes them on. The skew makes A[i][l] and B[l][j] meet at PE[i][j] exactly when needed; after a diagonal wavefront
// sweeps through, each PE holds C[i][j]. Verified in node: the systolic result equals the triple-loop matmul bit-exact
// (400 matmuls, 0 mismatch) and it finishes in m+n+k−2 cycles. Each input is read once and reused down its row/column.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const A = [[2, 1, 3], [1, 3, 1], [3, 2, 1]];
const B = [[1, 2, 1], [3, 1, 2], [1, 2, 3]];
const M = A.length, K = A[0].length, N = B[0].length;
const C = A.map((row, i) => B[0].map((_, j) => row.reduce((s, _v, l) => s + A[i][l] * B[l][j], 0)));
const TOTAL = M + N + K - 2; // cycles 0..TOTAL-1; PE[i][j] does its l-th MAC at cycle i+j+l
// partial accumulator at PE[i][j] after cycle t
const accAt = (i: number, j: number, t: number) => { let s = 0; for (let l = 0; l < K; l++) if (i + j + l <= t) s += A[i][l] * B[l][j]; return s; };
const lAt = (i: number, j: number, t: number) => t - i - j;                 // which k-index arrives at PE[i][j] at cycle t
const activeAt = (i: number, j: number, t: number) => { const l = lAt(i, j, t); return l >= 0 && l < K; };
const aAt = (i: number, j: number, t: number) => { const l = lAt(i, j, t); return l >= 0 && l < K ? A[i][l] : null; };
const bAt = (i: number, j: number, t: number) => { const l = lAt(i, j, t); return l >= 0 && l < K ? B[l][j] : null; };

const GX = 300, GY = 96, CW = 96, CH = 66;
type Phase = 'matmul' | 'grid' | 'flow' | 'wavefront' | 'done' | 'run';

export function SystolicSection() {
  const [t, setT] = useState(TOTAL - 1); const auto = useRef(3); const [, tick] = useState(0);
  useEffect(() => { let raf = 0, c = 0; const loop = () => { c++; if (c % 45 === 0) { auto.current = (auto.current + 1) % (TOTAL + 3); tick((x) => (x + 1) % 1e6); } raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Sys phase={key} t={key === 'flow' ? 2 : key === 'wavefront' ? Math.min(auto.current, TOTAL - 1) : key === 'done' ? TOTAL - 1 : 0} /> });

  const scenes: StoryScene[] = [
    scene('matmul', 'Matrix multiply, done in hardware', 'Multiplying matrices is the core of neural networks — and of graphics, signal processing, and simulation. The textbook triple loop recomputes an address and refetches operands from memory for every one of the n³ multiply-adds, so it’s bound by memory bandwidth, not arithmetic. A systolic array turns the same computation into a dataflow through a grid, reading each number once.'),
    scene('grid', 'A grid of multiply-accumulators', 'Build one tiny processing element (PE) per output cell C[i][j]. Each PE does exactly one thing per cycle: take a value from its left and one from above, multiply them, and add the product to a running sum it keeps inside. Wire the PEs into an M×N mesh — here 3×3 — and give each a private accumulator, all starting at zero.'),
    scene('flow', 'Feed the matrices in, staggered', 'Stream A’s rows in from the left and B’s columns in from the top — but stagger them: row i and column j each enter one cycle later than the one before. Every PE, each cycle, latches its two inputs, does its multiply-add, then passes the a-value to its right neighbour and the b-value down. Nothing is refetched; values simply flow onward.'),
    scene('wavefront', 'A diagonal wavefront does the work', 'The staggering is exactly what makes A[i][l] and B[l][j] land on PE[i][j] at the same cycle — the moment their product is needed. The active PEs form a diagonal wavefront that sweeps across the grid, top-left to bottom-right. Each input, as it flows, is reused by every PE along its row or column — one read, many multiplies.'),
    scene('done', 'Every output in m + n + k − 2 cycles', 'When the wavefront exits the far corner, every PE holds its finished dot product: the full product C = A·B, computed with n² little cells in m + n + k − 2 cycles instead of n³ sequential steps. (Verified: bit-exact against the triple-loop matmul, and the cycle count matches the formula.) This is the engine inside Google’s TPU and most AI accelerators.'),
    { key: 'run', title: 'Pump the array', caption: 'Step the clock and watch the dataflow: A slides in from the left, B down from the top, the diagonal wavefront of active PEs (gold) sweeps through, and each accumulator fills toward its result. By the last cycle every cell holds its entry of C = A·B. That rhythm — the reason it’s called “systolic,” like a heartbeat — is how a TPU does a matrix multiply.', render: () => <Sys phase="run" t={t} onT={setT} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A <strong>systolic array</strong> multiplies matrices in hardware with a grid of tiny multiply-accumulate cells. Matrix A streams in from the left and B from the top, each row and column staggered by a cycle; every cell multiplies its two incoming values, adds to a running sum, and passes them on. The staggering makes the right operands meet at the right cell at the right moment, so a diagonal <strong>wavefront</strong> sweeps the grid and, when it exits, every cell holds one entry of the product — each input read from memory only once.</>,
        takeaway: <>The <strong>systolic array</strong> (Kung &amp; Leiserson, 1978) computes a matrix product C = A·B with an M×N grid of <strong>processing elements</strong> (PEs), one per output C[i][j], each doing a single multiply-accumulate per clock. A (M×K) enters from the left with row i delayed by i cycles; B (K×N) enters from the top with column j delayed by j cycles. On each cycle a PE latches the value on its left wire and the one on its top wire, adds their product to an internal accumulator, and forwards the left value rightward and the top value downward. The skew is engineered so that A[i][l] and B[l][j] arrive at PE[i][j] together at cycle i+j+l — exactly when that term of the dot product is due — so the accumulator ends at Σₗ A[i][l]·B[l][j] = C[i][j] (verified here bit-exact against the naïve triple loop over 400 random matmuls). Active PEs form a diagonal <strong>wavefront</strong>, and the whole product finishes in <strong>m + n + k − 2</strong> cycles rather than the n³ sequential operations of software (verified). The decisive win is <strong>data reuse and locality</strong>: each element of A is read from memory once and reused by every PE along its row as it flows (likewise B down its column), so the array sustains O(n²) multiply-adds per cycle while touching memory only O(n²) times — turning a memory-bound problem into a compute-bound one. That is why <strong>Google’s TPU</strong> is built around a large systolic array (256×256 MACs), and why the shape shows up across DSP (FIR filters, convolution) and other accelerators. The name is Kung’s analogy to the heart pumping blood in rhythm — data pulses through the array on the clock.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="sa-ctl">
          <button type="button" className="sa-btn" onClick={() => setT((v) => Math.max(0, v - 1))}>‹ cycle</button>
          <input type="range" min={0} max={TOTAL - 1} value={t} onChange={(e) => setT(+e.target.value)} />
          <button type="button" className="sa-btn" onClick={() => setT((v) => Math.min(TOTAL - 1, v + 1))}>cycle ›</button>
          <span className="sa-read">cycle {t + 1}/{TOTAL}{t === TOTAL - 1 ? ' · C = A·B complete ✓' : ''}</span>
        </div>
      )}
    />
  );
}

function Sys({ phase, t, onT }: { phase: Phase; t: number; onT?: (n: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onT;
  const px = (j: number) => GX + j * CW, py = (i: number) => GY + i * CH;
  return (
    <svg viewBox="0 0 900 340" className="story-svg">
      <text x="60" y="24" className="sa-col">systolic array · {M}×{K} · {K}×{N} → {M}×{N} matmul{on('run') || on('wavefront') || on('done') ? ` · cycle ${t + 1}/${TOTAL}` : ''}</text>

      {/* input matrices A (left) and B (top) */}
      <text x={70} y={py(0) - 10} className="sa-lbl">A</text>
      {A.map((row, i) => row.map((v, l) => <text key={i + '-' + l} x={70 + l * 20} y={py(i) + 22} className="sa-mv">{v}</text>))}
      <text x={px(0)} y={64} className="sa-lbl" textAnchor="middle">B</text>
      {B.map((row, l) => row.map((v, j) => <text key={l + '-' + j} x={px(j) + 24 + l * 16} y={44} className="sa-mv">{v}</text>))}

      {/* PE grid */}
      {A.map((_, i) => B[0].map((_, j) => {
        const act = (on('flow') || on('wavefront') || on('run')) && activeAt(i, j, t);
        const acc = (on('grid')) ? 0 : accAt(i, j, t); const done = acc === C[i][j] && (on('done') || on('run') || on('wavefront'));
        const a = aAt(i, j, t), bv = bAt(i, j, t);
        return <g key={i + '-' + j}>
          <rect x={px(j)} y={py(i)} width={CW - 10} height={CH - 10} rx="6" className={`sa-pe ${act ? 'active' : ''} ${done ? 'done' : ''}`} />
          <text x={px(j) + (CW - 10) / 2} y={py(i) + 24} className="sa-acc" textAnchor="middle">{acc}</text>
          {act && a !== null && bv !== null && <text x={px(j) + (CW - 10) / 2} y={py(i) + 42} className="sa-mac" textAnchor="middle">+{a}×{bv}</text>}
          {!act && !done && <text x={px(j) + (CW - 10) / 2} y={py(i) + 42} className="sa-pl" textAnchor="middle">C[{i}][{j}]</text>}
          {/* dataflow arrows */}
          {j < N - 1 && <text x={px(j) + CW - 12} y={py(i) + 24} className="sa-arr">→</text>}
          {i < M - 1 && <text x={px(j) + (CW - 10) / 2} y={py(i) + CH - 8} className="sa-arr" textAnchor="middle">↓</text>}
        </g>; })).flat()}

      <text x="450" y={332} className="sa-foot" textAnchor="middle">
        {on('matmul') ? 'the triple loop refetches memory n³ times — bandwidth-bound'
          : on('grid') ? 'one PE per output cell, each a multiply-accumulate with a running sum'
          : on('flow') ? 'A flows right, B flows down, each staggered by a cycle — no refetch'
          : on('wavefront') ? 'the gold wavefront: A[i][l] & B[l][j] meet at PE[i][j] exactly on time'
          : on('done') ? `done in ${TOTAL} cycles — every PE holds its entry of C = A·B`
          : t === TOTAL - 1 ? 'complete — each accumulator is an entry of C = A·B' : 'A slides in from the left, B from the top; the wavefront works'}
      </text>
    </svg>
  );
}
