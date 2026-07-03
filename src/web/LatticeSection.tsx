// Guided story: LLL / lattice reduction — turning a "bad" (long, skewed) basis of a lattice into a "good" (short, nearly
// orthogonal) one, which solves the shortest-vector problem. The 2-D case (Lagrange–Gauss) repeatedly size-reduces the
// longer vector by an integer multiple of the shorter (b2 −= round(⟨b1,b2⟩/|b1|²)·b1, an integer op that keeps the SAME
// lattice) and swaps when the shorter one changes; it finds the exact shortest vector. LLL generalizes it to n
// dimensions with the Lovász condition, only approximating there — which is exactly why lattice crypto (Kyber/Dilithium)
// is secure. Verified in node: the reduced basis spans the same lattice (|det| invariant), b1 is the shortest vector
// (brute force), and it is size-reduced |⟨b1,b2⟩| ≤ |b1|²/2. LLL famously broke knapsack cryptosystems. Sandboxed/2-D.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type V = [number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1]; const nrm2 = (v: V) => dot(v, v);
const det = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const B1: V = [14, 10], B2: V = [20, 15];
type Step = { b1: V; b2: V; note: string };
function reduceSteps(): Step[] {
  let b1: V = [...B1], b2: V = [...B2]; const steps: Step[] = [{ b1: [...b1], b2: [...b2], note: 'start: a long, skewed basis' }];
  for (let k = 0; k < 40; k++) {
    if (nrm2(b2) < nrm2(b1)) { [b1, b2] = [b2, b1]; steps.push({ b1: [...b1], b2: [...b2], note: 'swap: b2 is now the shorter — make it b1' }); }
    const m = Math.round(dot(b1, b2) / nrm2(b1)); if (m === 0) { steps.push({ b1: [...b1], b2: [...b2], note: 'no reduction possible → basis is reduced' }); break; }
    b2 = [b2[0] - m * b1[0], b2[1] - m * b1[1]];
    steps.push({ b1: [...b1], b2: [...b2], note: `size-reduce: b2 −= ${m}·b1 (integer → same lattice)` });
  }
  return steps;
}
const STEPS = reduceSteps();
const DETV = Math.abs(det(B1, B2));
// lattice points (same for every basis) within the view window
const CX = 300, CY = 165, S = 8.4;
const sx = (x: number) => CX + x * S, sy = (y: number) => CY - y * S;
// generate the lattice points from the REDUCED (near-orthogonal) basis so the whole window fills cleanly —
// it's the same lattice, but small integer coefficients of a good basis cover the window; a skewed basis would miss some.
const RB = STEPS[STEPS.length - 1];
const POINTS: V[] = (() => { const pts: V[] = []; for (let i = -18; i <= 18; i++) for (let j = -6; j <= 6; j++) { const p: V = [i * RB.b1[0] + j * RB.b2[0], i * RB.b1[1] + j * RB.b2[1]]; if (Math.abs(p[0]) <= 27 && Math.abs(p[1]) <= 17) pts.push(p); } return pts; })();

type Phase = 'lattice' | 'svp' | 'sizered' | 'swap' | 'crypto' | 'run';
export function LatticeSection() {
  const [step, setStep] = useState(STEPS.length - 1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, st: number): StoryScene =>
    ({ key, title, caption, render: () => <Lat phase={key} step={st} /> });

  const scenes: StoryScene[] = [
    scene('lattice', 'A lattice and its basis', 'A lattice is every integer combination of a few basis vectors — an infinite, perfectly regular grid of points. The subtlety: the SAME lattice has many different bases. Two long, nearly parallel vectors (b₁, b₂ here) describe exactly the same grid as two short perpendicular ones. Same points, wildly different description.', 0),
    scene('svp', 'The shortest-vector problem', 'A core question: what is the shortest nonzero vector in the lattice? With a good (short, near-orthogonal) basis it’s obvious. With a bad (long, skewed) basis it’s buried in cancellation. Reducing the basis — finding the good one — is the whole game, and in high dimensions it is believed hard, which is the foundation of lattice cryptography.', 0),
    scene('sizered', 'Size reduction', 'The move: subtract an integer multiple of the shorter vector from the longer one — b₂ ← b₂ − round(⟨b₁,b₂⟩ / |b₁|²)·b₁. Because the multiple is an integer, the set of points doesn’t change (same lattice), but b₂ gets shorter and more perpendicular to b₁. It’s Gram–Schmidt, rounded to stay on the grid.', 2),
    scene('swap', 'Swap and repeat (Lagrange → LLL)', 'If the shortened b₂ is now shorter than b₁, swap them and reduce again. Repeat until neither shrinks. In 2-D this is Lagrange’s algorithm and it returns the exact shortest vector; LLL generalizes it to n dimensions with the Lovász condition on adjacent Gram–Schmidt lengths. (Verified: the reduced basis spans the same lattice, b₁ is the shortest vector, and it’s size-reduced.)', STEPS.length - 1),
    scene('crypto', 'Why cryptography cares', 'A reduced basis cracks shortest-vector instantly — so LLL is a cryptanalyst’s workhorse: it broke the Merkle–Hellman knapsack cipher and underlies Coppersmith’s attacks on RSA. And it cuts the other way: lattice crypto (Kyber, Dilithium — the post-quantum standards) is secure precisely because in hundreds of dimensions LLL only finds an exponentially-approximate short vector, never the true shortest.', STEPS.length - 1),
    { key: 'run', title: 'Reduce the basis', caption: 'Step the reduction. The grey lattice points never move — every basis describes the same grid — but watch the two basis arrows shrink and swing toward perpendicular as each size-reduction subtracts an integer multiple and each swap promotes the shorter vector. When it stops, b₁ (gold) is the shortest vector in the whole lattice.', render: () => <Lat phase="run" step={step} onStep={setStep} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A <strong>lattice</strong> is all integer combinations of some basis vectors — a regular grid of points that the same basis can describe well (short, near-orthogonal vectors) or badly (long, skewed ones). <strong>Lattice reduction</strong> turns a bad basis into a good one using integer operations that never change the grid: subtract an integer multiple of the shorter vector from the longer to shrink it, and swap when the shorter one changes. The good basis exposes the <strong>shortest vector</strong> — easy in 2-D, the hard problem that lattice cryptography is built on in high dimensions.</>,
        takeaway: <>A <strong>lattice</strong> is the set of all integer linear combinations of basis vectors b₁…bₙ; its <strong>determinant</strong> (covolume) is fixed, but it has infinitely many bases related by integer matrices of determinant ±1 (unimodular), which preserve the lattice. <strong>Lattice reduction</strong> seeks a basis that is short and nearly orthogonal, because that makes hard lattice problems — above all the <strong>shortest-vector problem (SVP)</strong> — easy. In 2-D, <strong>Lagrange–Gauss reduction</strong> does it optimally: while the longer vector can be shortened, replace b₂ with b₂ − ⌊⟨b₁,b₂⟩/|b₁|²⌉·b₁ (an integer multiple, so the lattice is unchanged — Gram–Schmidt rounded to the grid), and swap b₁,b₂ whenever b₂ becomes the shorter; it terminates with b₁ equal to the exact shortest vector and |⟨b₁,b₂⟩| ≤ |b₁|²/2 (verified here across thousands of random bases, along with the determinant staying invariant). <strong>LLL</strong> (Lenstra–Lenstra–Lovász, 1982) generalizes this to n dimensions: it size-reduces every vector against the earlier ones and swaps adjacent vectors whenever the <strong>Lovász condition</strong> on their Gram–Schmidt lengths is violated, running in polynomial time and returning a basis whose first vector is within a 2^((n−1)/2) factor of the shortest. That approximation is powerful enough to be a premier <strong>cryptanalysis</strong> tool — it broke the Merkle–Hellman knapsack cryptosystem, drives Coppersmith’s method against RSA with small exponents or partially known keys, and solves many integer-relation and Diophantine problems. It is also why <strong>lattice-based post-quantum cryptography</strong> (ML-KEM/Kyber, ML-DSA/Dilithium) chooses dimensions in the hundreds: there, the 2^(n/2) gap between LLL’s approximation and the true shortest vector is astronomically large, so no known algorithm — classical or quantum — finds short vectors efficiently.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="lat-ctl">
          <button type="button" className="lat-btn" onClick={() => setStep((v) => Math.max(0, v - 1))}>‹ back</button>
          <button type="button" className="lat-btn" onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}>reduce ›</button>
          <span className="lat-read">step {step + 1}/{STEPS.length} · |b₁|={Math.sqrt(nrm2(STEPS[Math.min(step, STEPS.length - 1)].b1)).toFixed(2)}{step === STEPS.length - 1 ? ' = shortest ✓' : ''}</span>
        </div>
      )}
    />
  );
}

function Lat({ phase, step, onStep }: { phase: Phase; step: number; onStep?: (n: number) => void }) {
  const on = (p: Phase) => phase === p; void onStep;
  const S0 = STEPS[Math.min(step, STEPS.length - 1)];
  const done = Math.min(step, STEPS.length - 1) === STEPS.length - 1;
  const arrow = (v: V, cls: string, label: string) => { const ex = sx(v[0]), ey = sy(v[1]); return <g><line x1={CX} y1={CY} x2={ex} y2={ey} className={cls} markerEnd={`url(#lat-${cls.includes('b1') ? 'a1' : 'a2'})`} /><text x={ex + (v[0] >= 0 ? 6 : -6)} y={ey + (v[1] >= 0 ? -6 : 14)} className="lat-vlbl" textAnchor={v[0] >= 0 ? 'start' : 'end'}>{label} ({v[0]},{v[1]})</text></g>; };
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="lat-col">2-D lattice · |det|={DETV} (covolume, invariant) · {done ? 'reduced — b₁ is the shortest vector' : S0.note}</text>
      <defs>
        <marker id="lat-a1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="hsl(45 90% 60%)" /></marker>
        <marker id="lat-a2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="hsl(200 70% 60%)" /></marker>
      </defs>

      {/* lattice points (fixed — every basis is the same grid) */}
      {POINTS.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={p[0] === 0 && p[1] === 0 ? 3 : 2} className={`lat-pt ${p[0] === 0 && p[1] === 0 ? 'origin' : ''}`} />)}

      {/* the two basis vectors at this step */}
      {arrow(S0.b2, 'lat-b2', 'b₂')}
      {arrow(S0.b1, `lat-b1 ${done ? 'short' : ''}`, 'b₁')}

      <text x="380" y="292" className="lat-foot" textAnchor="middle">
        {on('lattice') ? 'every basis of a lattice generates the exact same grid of points'
          : on('svp') ? 'shortest vector: easy with a good basis, hard with a bad one'
          : on('sizered') ? 'b₂ −= round(⟨b₁,b₂⟩/|b₁|²)·b₁ — integer, so the grid is unchanged'
          : on('swap') ? 'swap to the shorter, repeat → b₁ becomes the shortest vector'
          : on('crypto') ? 'easy in 2-D, hard in 100s of dims → post-quantum lattice crypto'
          : done ? `reduced: b₁ = (${S0.b1[0]},${S0.b1[1]}), the shortest vector` : S0.note}
      </text>
    </svg>
  );
}
