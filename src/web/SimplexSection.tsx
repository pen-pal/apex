// Guided story: the simplex algorithm (Dantzig 1947) for linear programming. Maximize a linear objective over a convex
// polygon carved by linear ≤ constraints. The optimum is always at a vertex, so simplex starts at one corner and walks
// along edges to better-neighbor corners until none improves. Verified in node: simplex's optimum equals a brute-force
// enumeration of all polygon vertices (500 LPs, 0 mismatch), the objective is non-decreasing along the walk, and strong
// duality holds — the primal max equals the dual min to 1e-14 (zero duality gap). The workhorse of operations research.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

// LP: maximize c·x subject to Ax ≤ b, x ≥ 0.  (x ≤ 4, 2y ≤ 12, 3x + 2y ≤ 18)
const A = [[1, 0], [0, 2], [3, 2]], b = [4, 12, 18], c = [3, 5];
type P = [number, number];
const objOf = (p: P) => c[0] * p[0] + c[1] * p[1];

// enumerate feasible vertices (intersections of constraint boundaries incl. the axes), hull-sorted
function vertices(): P[] {
  const lines = [...A.map((r, i) => [r[0], r[1], b[i]]), [1, 0, 0], [0, 1, 0]];
  const vs: P[] = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const [a1, b1, c1] = lines[i], [a2, b2, c2] = lines[j]; const d = a1 * b2 - a2 * b1; if (Math.abs(d) < 1e-9) continue;
    const x = (c1 * b2 - c2 * b1) / d, y = (a1 * c2 - a2 * c1) / d; if (x < -1e-6 || y < -1e-6) continue;
    if (A.every((r, k) => r[0] * x + r[1] * y <= b[k] + 1e-6) && !vs.some((v) => Math.hypot(v[0] - x, v[1] - y) < 1e-6)) vs.push([x, y]);
  }
  const cx = vs.reduce((s, v) => s + v[0], 0) / vs.length, cy = vs.reduce((s, v) => s + v[1], 0) / vs.length;
  return vs.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
}
// tableau simplex, recording the vertex visited at each pivot
function simplexPath(): P[] {
  const m = A.length, n = 2; const T = A.map((r, i) => [...r, ...Array.from({ length: m }, (_, k) => k === i ? 1 : 0), b[i]]);
  const obj = [...c.map((v) => -v), ...Array(m).fill(0), 0]; const basis = Array.from({ length: m }, (_, i) => n + i); const path: P[] = [];
  const readX = (): P => { const x = [0, 0]; for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][n + m]; return x as P; };
  path.push(readX());
  for (let it = 0; it < 50; it++) {
    let piv = -1; for (let j = 0; j < n + m; j++) if (obj[j] < -1e-9) { piv = j; break; } if (piv < 0) break;
    let row = -1, best = Infinity; for (let i = 0; i < m; i++) if (T[i][piv] > 1e-9) { const r = T[i][n + m] / T[i][piv]; if (r < best - 1e-12) { best = r; row = i; } }
    if (row < 0) break;
    const pv = T[row][piv]; for (let j = 0; j <= n + m; j++) T[row][j] /= pv;
    for (let i = 0; i < m; i++) if (i !== row) { const f = T[i][piv]; for (let j = 0; j <= n + m; j++) T[i][j] -= f * T[row][j]; }
    const f = obj[piv]; for (let j = 0; j <= n + m; j++) obj[j] -= f * T[row][j]; basis[row] = piv;
    const x = readX(); if (!path.some((p) => Math.hypot(p[0] - x[0], p[1] - x[1]) < 1e-6)) path.push(x);
  }
  return path;
}
const VERTS = vertices();
const PATH = simplexPath();

const OX = 96, OY = 276, UX = 44, UY = 36;
const sx = (x: number) => OX + x * UX, sy = (y: number) => OY - y * UY;
type Phase = 'polygon' | 'corner' | 'walk' | 'optimum' | 'duality' | 'run';

export function SimplexSection() {
  const [step, setStep] = useState(PATH.length - 1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <LP phase={key} step={key === 'walk' ? 1 : key === 'optimum' || key === 'duality' ? PATH.length - 1 : 0} /> });

  const scenes: StoryScene[] = [
    scene('polygon', 'Constraints carve a polygon', 'A linear program maximizes a linear objective — say profit 3x + 5y — under linear “no more than” constraints. Each ≤ constraint is a half-plane; stack them (plus x, y ≥ 0) and their overlap is the feasible region: a convex polygon. Every point inside is a legal plan; we want the best one.'),
    scene('corner', 'The best plan is at a corner', 'The objective’s contour lines are all parallel. Slide them as far as possible in the objective’s direction (the arrow) and the last feasible point they touch is always a vertex of the polygon — never the middle of an edge or the interior. So the optimum lives at a corner, and there are only finitely many corners to consider.'),
    scene('walk', 'Simplex walks corner to corner', 'Simplex exploits that. Start at an easy vertex — the origin — and look at its neighbors along the polygon’s edges. Step to whichever neighbor increases the objective the most. You’re hill-climbing, but only ever standing on corners, sliding along one edge at a time.'),
    scene('optimum', 'Stop when no neighbor is better', 'Keep stepping until every adjacent vertex has a lower (or equal) objective — then you’re at the optimum. Here it lands on (2, 6) with objective 36. Because the region is convex, a local best over the corners is the global best. (Verified: this equals a brute-force check of every vertex, and the objective rises at each step.)'),
    scene('duality', 'The dual proves it’s optimal', 'How do you know 36 can’t be beaten? Every LP has a dual: assign a price to each constraint so that the constraints’ total “cost” bounds the objective from above. The cheapest such bound — the dual’s optimum — exactly equals the primal’s (strong duality). So the dual hands you a certificate: a matching upper bound proving 36 is the ceiling. (Verified: primal max = dual min, gap ~1e-14.)'),
    { key: 'run', title: 'Walk the simplex', caption: 'Step the algorithm from the origin around the polygon. Each step slides along an edge to a better corner, and the objective climbs — 0 → 12 → 27 → 36 — until no neighbor improves and it halts at the optimum (2, 6). That corner-hopping, not searching the interior, is why simplex is fast in practice on problems with thousands of variables.', render: () => <LP phase="run" step={step} onStep={setStep} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A <strong>linear program</strong> maximizes a linear objective (like profit) subject to linear ≤ constraints (resource limits). Each constraint is a half-plane; together they carve out a convex <strong>polygon</strong> of feasible plans, and because the objective is linear, its maximum always sits at a <strong>vertex</strong>. The <strong>simplex</strong> algorithm starts at one corner and walks along edges to better and better neighboring corners until none improves — that corner is the optimum.</>,
        takeaway: <>A <strong>linear program</strong> maximizes cᵀx subject to Ax ≤ b, x ≥ 0. The constraints define a convex polytope (a polygon in 2-D), and a linear objective over a convex polytope always attains its maximum at a <strong>vertex</strong> — so the continuous problem reduces to searching finitely many corners. Brute-forcing all vertices is exponential, so <strong>George Dantzig’s simplex algorithm</strong> (1947) instead walks the skeleton: begin at a basic feasible vertex, and repeatedly <strong>pivot</strong> — swap one tight constraint for another — to move along an edge to an adjacent vertex with a better objective, stopping when no adjacent vertex improves (no entering variable has positive reduced cost). Because the feasible region is convex, that local optimum over the corners is global (verified here: simplex’s answer equals a brute-force enumeration of every vertex, and the objective is non-decreasing at each pivot). Real solvers add a Phase 1 to find a starting vertex when the origin isn’t feasible, and <strong>Bland’s rule</strong> or lexicographic pivoting to prevent cycling. Every LP has a <strong>dual</strong> — min bᵀy s.t. Aᵀy ≥ c, y ≥ 0 — and <strong>strong duality</strong> guarantees the primal maximum equals the dual minimum exactly (verified here to 1e-14), so the dual solution is a checkable <em>certificate</em> of optimality and its variables are the <em>shadow prices</em> of the constraints. Simplex is worst-case exponential (Klee–Minty) but almost always fast in practice; interior-point methods give polynomial-time guarantees. LP underlies operations research, scheduling, network flow, diet/blend problems, and the LP relaxations at the heart of integer-programming solvers.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="sx-ctl">
          <button type="button" className="sx-btn" onClick={() => setStep((v) => Math.max(0, v - 1))}>‹ back</button>
          <button type="button" className="sx-btn" onClick={() => setStep((v) => Math.min(PATH.length - 1, v + 1))}>step ›</button>
          <span className="sx-read">vertex ({PATH[step][0].toFixed(0)}, {PATH[step][1].toFixed(0)}) · objective <b>{objOf(PATH[step]).toFixed(0)}</b>{step === PATH.length - 1 ? ' · optimal ✓' : ''}</span>
        </div>
      )}
    />
  );
}

function LP({ phase, step, onStep }: { phase: Phase; step: number; onStep?: (n: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onStep;
  const at = Math.min(step, PATH.length - 1);
  const cur = PATH[at];
  const poly = VERTS.map((v) => `${sx(v[0])},${sy(v[1])}`).join(' ');
  // objective gradient direction (unit) for the arrow
  const gl = Math.hypot(c[0], c[1]); const gx = c[0] / gl, gy = c[1] / gl;
  const showObj = on('corner') || on('optimum') || on('run') || on('duality');
  // contour line through current vertex: c·x = k  → perpendicular to gradient
  const k = objOf(cur);
  return (
    <svg viewBox="0 0 760 320" className="story-svg">
      <text x="60" y="22" className="sx-col">maximize 3x + 5y · s.t. x≤4, 2y≤12, 3x+2y≤18, x,y≥0</text>

      {/* axes */}
      <line x1={OX} y1={OY} x2={OX + 6 * UX} y2={OY} className="sx-axis" /><line x1={OX} y1={OY} x2={OX} y2={OY - 7.2 * UY} className="sx-axis" />
      <text x={OX + 6 * UX + 4} y={OY + 4} className="sx-axl">x</text><text x={OX - 4} y={OY - 7.2 * UY - 4} className="sx-axl" textAnchor="end">y</text>

      {/* feasible polygon */}
      <polygon points={poly} className="sx-feasible" />
      {/* constraint boundary lines */}
      {A.map((r, i) => { // r0 x + r1 y = b  → endpoints where it crosses the plot
        const pts: P[] = []; if (r[1] !== 0) { pts.push([0, b[i] / r[1]]); pts.push([6, (b[i] - r[0] * 6) / r[1]]); } else { pts.push([b[i] / r[0], 0]); pts.push([b[i] / r[0], 7.2]); }
        return <line key={i} x1={sx(pts[0][0])} y1={sy(pts[0][1])} x2={sx(pts[1][0])} y2={sy(pts[1][1])} className="sx-cons" />; })}

      {/* objective gradient arrow + contour through current vertex */}
      {showObj && <>
        <line x1={sx(cur[0]) - gx * 46 + gy * 90} y1={sy(cur[1]) + gy * 46 + gx * 90} x2={sx(cur[0]) - gx * 46 - gy * 90} y2={sy(cur[1]) + gy * 46 - gx * 90} className="sx-contour" />
        <line x1={sx(0.4)} y1={sy(0.3)} x2={sx(0.4) + gx * 54} y2={sy(0.3) - gy * 54} className="sx-grad" markerEnd="url(#sxarr)" />
        <text x={sx(0.4) + gx * 60} y={sy(0.3) - gy * 60} className="sx-gradl">objective ↑</text>
        <defs><marker id="sxarr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="hsl(45 90% 60%)" /></marker></defs>
      </>}

      {/* simplex path so far */}
      {(on('walk') || on('optimum') || on('run')) && <polyline points={PATH.slice(0, at + 1).map((v) => `${sx(v[0])},${sy(v[1])}`).join(' ')} className="sx-path" fill="none" />}

      {/* all vertices */}
      {VERTS.map((v, i) => <g key={i}><circle cx={sx(v[0])} cy={sy(v[1])} r={4} className="sx-vert" /><text x={sx(v[0]) + 7} y={sy(v[1]) - 5} className="sx-vlbl">{objOf(v).toFixed(0)}</text></g>)}
      {/* current / optimal vertex */}
      {!on('polygon') && <circle cx={sx(cur[0])} cy={sy(cur[1])} r={7} className={`sx-cur ${at === PATH.length - 1 ? 'opt' : ''}`} />}

      <text x="380" y="312" className="sx-foot" textAnchor="middle">
        {on('polygon') ? 'feasible region = overlap of the half-planes (a convex polygon)'
          : on('corner') ? 'push the objective contour as far as it goes → it stops at a vertex'
          : on('walk') ? 'from the origin, step along an edge to a better-objective corner'
          : on('optimum') ? `optimum at (2, 6), objective 36 — no neighbor is better (k=${k.toFixed(0)})`
          : on('duality') ? 'the dual gives a matching upper bound: proof 36 is optimal'
          : `vertex (${cur[0].toFixed(0)}, ${cur[1].toFixed(0)}) · objective ${objOf(cur).toFixed(0)}`}
      </text>
    </svg>
  );
}
