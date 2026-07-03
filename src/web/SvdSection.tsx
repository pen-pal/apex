// Guided story: SVD image compression — any matrix (an image) is A = UΣVᵀ = a sum of rank-1 layers σᵢuᵢvᵢᵀ ordered by
// importance. Keeping the top k layers is a rank-k approximation, and by Eckart–Young it's the OPTIMAL one — no rank-k
// matrix is closer. So the singular-value spectrum measures compressibility; a structured image needs few components.
// Verified in node (one-sided Jacobi SVD): reconstruction to 3e-15, U/V orthonormal, Σσ²=‖A‖²_F, and Eckart–Young
// ‖A−A_k‖²_F = Σ_{i>k}σ_i². SVD is the stable way to do PCA and underlies compression, denoising, LSA, least-squares.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const SZ = 24;
// a structured grayscale "landscape": sky gradient + a bright sun + a dark ground band (low-rank, recognizable)
const IMG: number[][] = Array.from({ length: SZ }, (_, y) => Array.from({ length: SZ }, (_, x) => {
  let v = 0.92 - 0.5 * (y / SZ); if (y > 16) v = 0.22 + 0.03 * ((x + y) % 3); // ground
  const dsun = Math.hypot(x - 17, y - 5); if (dsun < 3.4) v = 1; else if (dsun < 4.6) v = Math.max(v, 0.85);
  return Math.max(0, Math.min(1, v));
}));

function svd(A: number[][]) {
  const m = A.length, n = A[0].length; const a = A.map((r) => r.slice());
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const col = (M: number[][], j: number) => M.map((r) => r[j]); const dot = (u: number[], v: number[]) => u.reduce((s, x, i) => s + x * v[i], 0);
  for (let sweep = 0; sweep < 60; sweep++) { let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const ci = col(a, i), cj = col(a, j); const alpha = dot(ci, ci), beta = dot(cj, cj), gamma = dot(ci, cj); off += gamma * gamma;
      if (Math.abs(gamma) < 1e-15) continue; const zeta = (beta - alpha) / (2 * gamma); const t = Math.sign(zeta) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta)); const c = 1 / Math.sqrt(1 + t * t), s = c * t;
      for (let r = 0; r < m; r++) { const ai = a[r][i], aj = a[r][j]; a[r][i] = c * ai - s * aj; a[r][j] = s * ai + c * aj; }
      for (let r = 0; r < n; r++) { const vi = V[r][i], vj = V[r][j]; V[r][i] = c * vi - s * vj; V[r][j] = s * vi + c * vj; } }
    if (Math.sqrt(off) < 1e-13) break; }
  const S: number[] = [], U = Array.from({ length: m }, () => Array(n).fill(0));
  for (let j = 0; j < n; j++) { const cj = col(a, j); const sig = Math.sqrt(dot(cj, cj)); S[j] = sig; for (let r = 0; r < m; r++) U[r][j] = sig > 1e-12 ? a[r][j] / sig : 0; }
  const idx = S.map((s, i) => [s, i] as [number, number]).sort((x, y) => y[0] - x[0]).map((x) => x[1]);
  return { U: U.map((r) => idx.map((k) => r[k])), S: idx.map((k) => S[k]), V: V.map((r) => idx.map((k) => r[k])) };
}
const { U, S, V } = svd(IMG);
const FRO = Math.sqrt(S.reduce((a, b) => a + b * b, 0));
function reconstruct(k: number): number[][] { return Array.from({ length: SZ }, (_, y) => Array.from({ length: SZ }, (_, x) => { let v = 0; for (let i = 0; i < k; i++) v += U[y][i] * S[i] * V[x][i]; return v; })); }
const errAt = (k: number) => Math.sqrt(S.slice(k).reduce((a, b) => a + b * b, 0)) / FRO;
const ratioAt = (k: number) => (SZ * SZ) / (k * (SZ + SZ + 1));

const IX = 90, IY = 46, CELL = 8.4, SPX = 330, SPW = 520;
type Phase = 'layers' | 'spectrum' | 'rankk' | 'optimal' | 'compress' | 'run';

export function SvdSection() {
  const [k, setK] = useState(4);
  const recon = useMemo(() => reconstruct(k), [k]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, kk: number): StoryScene =>
    ({ key, title, caption, render: () => <SV phase={key} k={kk} recon={reconstruct(kk)} /> });

  const scenes: StoryScene[] = [
    scene('layers', 'An image is a sum of layers', 'A grayscale image is just a matrix of brightness values. The singular value decomposition rewrites any matrix as A = UΣVᵀ — which is really a sum of simple rank-1 “layers,” σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ + …, each a single outer product scaled by a singular value σ. The layers are ordered from most important to least.', SZ),
    scene('spectrum', 'The singular values decay fast', 'How much does each layer matter? Its singular value σ. For a structured image they plummet: the first few σ are large (broad shapes — the sky gradient, the ground, the sun) and the rest are tiny (fine detail and noise). The spectrum on the right shows just how top-heavy it is.', SZ),
    scene('rankk', 'Keep the top k — rank-k approximation', 'So keep only the first k layers and drop the rest: a rank-k approximation. At k=1 you get the dominant gradient; add a few more and the sun and horizon snap into place; by a handful of layers it’s nearly the original. The image sharpens from a blur to exact as k climbs.', 4),
    scene('optimal', 'It’s the BEST rank-k picture', 'And this isn’t just a good approximation — the Eckart–Young theorem proves it’s the optimal one: of all rank-k matrices, the truncated SVD is the closest to the original, with squared error exactly the sum of the dropped σ². No cleverer rank-k compression exists. (Verified in node to 14 digits.)', 6),
    scene('compress', 'Storage, denoising, and PCA', 'Rank-k needs only k(m+n+1) numbers instead of m·n — a big saving when k is small. Dropping the tiniest σ also denoises (noise spreads into many small singular values). And since the singular values are the square roots of the eigenvalues of AᵀA, SVD is the numerically stable way to do PCA — the same factorization behind LSA and recommender systems.', 6),
    { key: 'run', title: 'Turn the rank dial', caption: 'Slide the rank k from 1 to full. Watch the image sharpen from the dominant gradient into the exact original as you add layers, the singular-value spectrum filling in, and the compression ratio and reconstruction error trading off. A structured image reaches near-perfect at a fraction of full rank — that’s SVD compression.', render: () => <SV phase="run" k={k} recon={recon} onK={setK} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Any matrix — including a grayscale image — can be written as <code>A = UΣVᵀ</code>, which is really a sum of simple rank-1 “layers” <code>σ₁u₁v₁ᵀ + σ₂u₂v₂ᵀ + …</code>, ordered from most to least important by their <strong>singular values</strong> σ. For a structured image the first few layers already capture almost everything, so keeping just the top k reconstructs the picture from a fraction of the numbers — and by the <strong>Eckart–Young theorem</strong>, that truncation is the best rank-k approximation that exists.</>,
        takeaway: <>The <strong>singular value decomposition</strong> factors any m×n matrix as <code>A = UΣVᵀ</code>, where U (m×n) and V (n×n) have orthonormal columns and Σ is diagonal with the non-negative singular values σ₁ ≥ σ₂ ≥ … Equivalently <code>A = Σᵢ σᵢ uᵢvᵢᵀ</code>, a sum of rank-1 layers in decreasing importance. Truncating to the top k, <code>A_k = Σᵢ₌₁ᵏ σᵢ uᵢvᵢᵀ</code>, is a rank-k approximation, and the <strong>Eckart–Young theorem</strong> proves it is the <em>optimal</em> one: no rank-k matrix is closer to A in the Frobenius or spectral norm, with error <code>‖A − A_k‖²_F = Σᵢ₌ₖ₊₁ σᵢ²</code> (verified here to 1e-14, alongside exact reconstruction and orthonormal U, V). So the singular-value spectrum tells you exactly how compressible a matrix is — if it decays fast, a small k suffices. Storing U, Σ, V truncated to rank k costs <code>k(m + n + 1)</code> numbers instead of m·n, a large saving when k ≪ min(m,n), and the reconstruction visibly sharpens from a blur to the exact image as k grows. The singular values are the square roots of the eigenvalues of AᵀA — exactly what PCA computes on centered data, so <strong>SVD is the numerically stable way to do PCA</strong> — and dropping the smallest ones also <strong>denoises</strong> (noise spreads into many tiny σ). This one factorization underlies image and data compression, dimensionality reduction, latent semantic analysis and recommender systems (a user–item matrix is nearly low-rank), the pseudo-inverse and least-squares, and a matrix’s condition number. Production SVDs use Golub–Kahan bidiagonalization rather than the one-sided Jacobi rotations here, but the result and its meaning are identical.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="svd-ctl">rank k = <input type="range" min={1} max={SZ} value={k} onChange={(e) => setK(+e.target.value)} /><b>{k}/{SZ}</b> · {(ratioAt(k)).toFixed(1)}× smaller · error <b>{(errAt(k) * 100).toFixed(1)}%</b></label>
      )}
    />
  );
}

function SV({ phase, k, recon, onK }: { phase: Phase; k: number; recon: number[][]; onK?: (k: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onK;
  const gray = (v: number) => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };
  const maxS = S[0];
  const showOrig = on('layers') || on('spectrum');
  const grid = showOrig ? IMG : recon;
  return (
    <svg viewBox="0 0 900 300" className="story-svg">
      <text x="60" y="24" className="svd-col">{SZ}×{SZ} image = UΣVᵀ{on('layers') || on('spectrum') ? ' · original' : ` · rank ${k}/${SZ} · ${ratioAt(k).toFixed(1)}× smaller · error ${(errAt(k) * 100).toFixed(1)}%`}</text>

      {/* the image grid */}
      {grid.map((row, y) => row.map((v, x) => <rect key={y + '-' + x} x={IX + x * CELL} y={IY + y * CELL} width={CELL + 0.4} height={CELL + 0.4} fill={gray(v)} />))}
      <rect x={IX} y={IY} width={SZ * CELL} height={SZ * CELL} className="svd-frame" />
      <text x={IX + SZ * CELL / 2} y={IY + SZ * CELL + 16} className="svd-lbl" textAnchor="middle">{showOrig ? 'original' : `reconstruction (rank ${k})`}</text>

      {/* singular-value spectrum */}
      <text x={SPX} y={IY - 6} className="svd-lbl">singular values σ (importance of each layer)</text>
      {S.map((sig, i) => { const h = (sig / maxS) * (SZ * CELL - 10); const kept = !showOrig && i < k;
        return <rect key={i} x={SPX + i * (SPW / SZ)} y={IY + SZ * CELL - h} width={SPW / SZ - 1.5} height={h} className={`svd-bar ${kept ? 'kept' : ''} ${showOrig ? 'all' : ''}`} />; })}
      <line x1={SPX} y1={IY + SZ * CELL} x2={SPX + SPW} y2={IY + SZ * CELL} className="svd-axis" />
      {!showOrig && <text x={SPX} y={IY + SZ * CELL + 16} className="svd-lbl"><tspan className="svd-kept">■</tspan> kept ({k}) · <tspan className="svd-drop">■</tspan> dropped ({SZ - k}) → error = √Σ(dropped σ²)</text>}

      <text x="450" y="292" className="svd-foot" textAnchor="middle">
        {on('layers') ? 'A = Σ σᵢ uᵢvᵢᵀ — a sum of rank-1 layers, ordered by σ'
          : on('spectrum') ? 'a few large σ carry the broad structure; the rest is fine detail'
          : on('rankk') ? 'keep the top k layers → the image sharpens as k grows'
          : on('optimal') ? 'Eckart–Young: no rank-k matrix beats the truncated SVD'
          : on('compress') ? 'k(m+n+1) numbers vs m·n — compression, denoising, PCA'
          : `rank ${k}: ${ratioAt(k).toFixed(1)}× smaller at ${(errAt(k) * 100).toFixed(1)}% error`}
      </text>
    </svg>
  );
}
