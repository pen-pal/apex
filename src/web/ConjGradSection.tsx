// Guided story: conjugate gradient (Hestenes & Stiefel 1952) — solve Ax=b for symmetric-positive-definite A, i.e.
// minimize the quadratic bowl f(x)=½xᵀAx−bᵀx. Steepest descent steps along −gradient and zigzags on a stretched bowl;
// CG uses A-orthogonal (conjugate) directions so a step in one never undoes another, reaching the exact minimum of an
// n-D bowl in ≤ n steps. Verified in node: CG == Gaussian elimination to 1e-16, ≤ n iterations, directions A-orthogonal,
// residuals mutually orthogonal. The workhorse for huge sparse SPD systems (FEM/PDE) — one matvec per step, no factoring.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type V = [number, number]; type M = [[number, number], [number, number]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const mv = (A: M, v: V): V => [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
const TH = 0.62; // eigenvector angle of the bowl
function makeA(kappa: number): M { const c = Math.cos(TH), s = Math.sin(TH), l1 = 1, l2 = kappa; return [[l1 * c * c + l2 * s * s, (l1 - l2) * c * s], [(l1 - l2) * c * s, l1 * s * s + l2 * c * c]]; }
// start point (min at origin). Put its error energy EQUAL along both eigen-directions (c1²λ1 = c2²λ2 with λ1=1,λ2=κ),
// the classic worst case that makes steepest descent zigzag maximally — otherwise a start on an eigen-axis goes straight.
const A0 = 2.7;
function startFor(kappa: number): V { const c = Math.cos(TH), s = Math.sin(TH), c1 = A0, c2 = A0 / Math.sqrt(kappa); return [c1 * c - c2 * s, c1 * s + c2 * c]; }

// steepest descent: x ← x − α·g, α = (g·g)/(g·Ag), g = Ax (min at 0)
function sdPath(A: M, x0: V, steps: number): V[] {
  let x = x0.slice() as V; const path = [x.slice() as V];
  for (let k = 0; k < steps; k++) { const g = mv(A, x); if (Math.hypot(...g) < 1e-9) break; const a = dot(g, g) / dot(g, mv(A, g)); x = [x[0] - a * g[0], x[1] - a * g[1]]; path.push(x.slice() as V); }
  return path;
}
// conjugate gradient
function cgPath(A: M, x0: V): V[] {
  let x = x0.slice() as V; let r: V = [-mv(A, x)[0], -mv(A, x)[1]]; let p = r.slice() as V; const path = [x.slice() as V];
  for (let k = 0; k < 2; k++) { const Ap = mv(A, p); const rr = dot(r, r); if (rr < 1e-14) break; const a = rr / dot(p, Ap); x = [x[0] + a * p[0], x[1] + a * p[1]]; path.push(x.slice() as V); const rn: V = [r[0] - a * Ap[0], r[1] - a * Ap[1]]; const beta = dot(rn, rn) / rr; p = [rn[0] + beta * p[0], rn[1] + beta * p[1]]; r = rn; }
  return path;
}

const CX = 300, CY = 165, S = 40;
const sx = (x: number) => CX + x * S, sy = (y: number) => CY - y * S;
type Phase = 'bowl' | 'steepest' | 'conjugate' | 'nsteps' | 'scale' | 'run';

export function ConjGradSection() {
  const [kappa, setKappa] = useState(8); const [show, setShow] = useState<'both' | 'sd' | 'cg'>('both');
  const A = useMemo(() => makeA(kappa), [kappa]);
  const sd = useMemo(() => sdPath(A, startFor(kappa), 40), [A, kappa]);
  const cg = useMemo(() => cgPath(A, startFor(kappa)), [A, kappa]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => { const kk = key === 'bowl' ? 5 : 8; const AA = makeA(kk), x0 = startFor(kk); return <CG phase={key} sd={sdPath(AA, x0, 40)} cg={cgPath(AA, x0)} show="both" kappa={kk} />; } });

  const scenes: StoryScene[] = [
    scene('bowl', 'Solving Ax = b is finding a valley', 'Solving a symmetric positive-definite system Ax = b is exactly the same as minimizing a quadratic bowl f(x) = ½xᵀAx − bᵀx — its lowest point is the solution. When A stretches one direction more than another, the bowl’s contours are long, narrow ellipses: a valley. The question is how to walk to the bottom.'),
    scene('steepest', 'Steepest descent zigzags', 'The obvious move: always step in the steepest downhill direction — the negative gradient — and go as far as that direction helps. But in a stretched valley, each best step lands where the next gradient points almost back the way you came, so the path zigzags across the valley in tiny strides, creeping toward the bottom. The worse the stretch, the more it flails.'),
    scene('conjugate', 'Conjugate directions don’t interfere', 'Conjugate gradient picks smarter directions: ones that are A-orthogonal (conjugate), pᵢᵀA pⱼ = 0. That’s the condition for a step along one direction to never spoil the progress made along another — so you never have to revisit a direction. No zigzag, no backtracking.'),
    scene('nsteps', 'Exactly n steps to the bottom', 'Because the n conjugate directions decouple the problem completely, CG reaches the exact minimum of an n-dimensional bowl in at most n steps. This 2-D bowl is solved in 2. (Verified: CG matches Gaussian elimination to 1e-16, in ≤ n iterations, with A-orthogonal directions and mutually orthogonal residuals.)'),
    scene('scale', 'Why it scales to millions of unknowns', 'Each CG step costs just one matrix–vector product and a few dot products — no matrix factorization, no dense storage of A. That’s why CG (with a preconditioner) is the workhorse for the enormous sparse SPD systems from finite-element and PDE solvers, reaching good accuracy in far fewer than n steps when A is well-conditioned.'),
    { key: 'run', title: 'Stretch the bowl', caption: 'Slide the condition number to stretch the valley, and compare. Steepest descent (orange) zigzags more and more as the bowl elongates, needing ever more steps. Conjugate gradient (green) always walks to the exact bottom in two — because its two directions are conjugate. Toggle either path; the gap is the whole reason CG exists.', render: () => <CG phase="run" sd={sd} cg={cg} show={show} kappa={kappa} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Solving a big linear system <code>Ax = b</code> (with A symmetric positive-definite) is the same as minimizing a quadratic <strong>bowl</strong> ½xᵀAx − bᵀx. <strong>Steepest descent</strong> — always stepping straight downhill — zigzags badly when the bowl is stretched, taking many tiny steps. <strong>Conjugate gradient</strong> fixes this by choosing search directions that are <em>conjugate</em> (A-orthogonal): each step fully resolves one direction and never undoes it, so it reaches the exact minimum of an n-dimensional bowl in at most n steps.</>,
        takeaway: <><strong>Conjugate gradient</strong> (Hestenes &amp; Stiefel, 1952) solves <code>Ax = b</code> for symmetric positive-definite A — equivalently, minimizes f(x) = ½xᵀAx − bᵀx, whose gradient is Ax − b. <strong>Steepest descent</strong> steps along the negative gradient (the residual r = b − Ax) with an optimal line search, but on an ill-conditioned (stretched) bowl consecutive gradients are nearly perpendicular, so it zigzags and converges slowly — at a rate set by the condition number κ. CG instead builds directions that are <strong>A-orthogonal</strong> (conjugate): pᵢᵀA pⱼ = 0 for i ≠ j. Minimizing along conjugate directions decouples the problem — a step in one never spoils another — so exact arithmetic reaches the true solution in at most n steps for an n×n system (verified here: CG matches Gaussian elimination to 1e-16 in ≤ n iterations, with A-orthogonal directions and mutually orthogonal residuals to 1e-15). Each iteration needs only one matrix–vector product and a few dot products — no factorization, no dense storage of A — which is why CG is the workhorse for the huge sparse SPD systems from finite-element and PDE solvers, and in floating point it’s used as an iterative method reaching good accuracy in far fewer than n steps when A is well-conditioned or <strong>preconditioned</strong>. It’s also the ancestor of the nonlinear conjugate-gradient methods used across optimization and machine learning.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="cg-ctl">
          <label>condition number κ <input type="range" min={1} max={20} step={0.5} value={kappa} onChange={(e) => setKappa(+e.target.value)} /><b>{kappa.toFixed(1)}</b></label>
          <span className="cg-leg"><span className="cg-swatch sd" /> steepest descent: <b>{sd.length - 1}</b> steps</span>
          <span className="cg-leg"><span className="cg-swatch cg" /> CG: <b>{cg.length - 1}</b> steps</span>
          <button type="button" className="cg-btn" onClick={() => setShow((v) => v === 'both' ? 'sd' : v === 'sd' ? 'cg' : 'both')}>show: {show}</button>
        </div>
      )}
    />
  );
}

function CG({ phase, sd, cg, show, kappa }: { phase: Phase; sd: V[]; cg: V[]; show: 'both' | 'sd' | 'cg'; kappa: number }) {
  const on = (p: Phase) => phase === p;
  // contour ellipses: level ½xᵀAx = c → semi-axes sqrt(2c/λ) along eigenvectors (λ1=1, λ2=κ), rotated by TH
  const l1 = 1, l2 = kappa; const deg = -TH * 180 / Math.PI;
  const contours = [0.4, 1.1, 2.2, 3.8, 6].map((c) => ({ rx: Math.sqrt(2 * c / l1) * S, ry: Math.sqrt(2 * c / l2) * S }));
  const showSD = (show === 'both' || show === 'sd') && !on('conjugate');
  const showCG = (show === 'both' || show === 'cg') && !on('steepest');
  const poly = (path: V[]) => path.map((p) => `${sx(p[0])},${sy(p[1])}`).join(' ');
  return (
    <svg viewBox="0 0 900 330" className="story-svg">
      <text x="60" y="24" className="cg-col">f(x) = ½xᵀAx − bᵀx · minimize the bowl (solve Ax=b) · κ={kappa.toFixed(1)}</text>

      {/* contour ellipses (the bowl) */}
      <g transform={`rotate(${deg} ${CX} ${CY})`}>{contours.map((e, i) => <ellipse key={i} cx={CX} cy={CY} rx={e.rx} ry={e.ry} className="cg-contour" />)}</g>
      <circle cx={CX} cy={CY} r={4} className="cg-min" /><text x={CX + 8} y={CY + 4} className="cg-lbl">min</text>
      {(() => { const x0 = startFor(kappa); return <><circle cx={sx(x0[0])} cy={sy(x0[1])} r={4} className="cg-start" /><text x={sx(x0[0]) + 8} y={sy(x0[1])} className="cg-lbl">start</text></>; })()}

      {/* steepest descent path */}
      {showSD && <><polyline points={poly(sd)} className="cg-sd" fill="none" />{sd.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={2.4} className="cg-sddot" />)}</>}
      {/* conjugate gradient path */}
      {showCG && <><polyline points={poly(cg)} className="cg-cg" fill="none" />{cg.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={3.4} className="cg-cgdot" />)}</>}

      {/* legend */}
      <g transform="translate(600 60)">
        {showSD && <><line x1={0} y1={0} x2={22} y2={0} className="cg-sd" /><text x={30} y={4} className="cg-leglbl">steepest descent — {sd.length - 1} steps</text></>}
        {showCG && <><line x1={0} y1={22} x2={22} y2={22} className="cg-cg" /><text x={30} y={26} className="cg-leglbl">conjugate gradient — {cg.length - 1} steps</text></>}
      </g>

      <text x="450" y="322" className="cg-foot" textAnchor="middle">
        {on('bowl') ? 'Ax=b ⟺ bottom of a quadratic bowl; stretched A → narrow valley'
          : on('steepest') ? 'each step ⟂ the last → zigzag across the valley, slow'
          : on('conjugate') ? 'A-orthogonal directions: pᵢᵀA pⱼ = 0 → no interference'
          : on('nsteps') ? 'n conjugate directions → exact minimum in n steps (here 2)'
          : on('scale') ? 'one matvec per step, no factorization → scales to millions'
          : `κ=${kappa.toFixed(1)}: steepest descent ${sd.length - 1} steps vs CG ${cg.length - 1}`}
      </text>
    </svg>
  );
}
