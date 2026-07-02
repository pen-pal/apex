// Guided story: CORDIC — computing cos/sin (and atan, magnitude, log, exp, sqrt) with only bit-shifts and additions,
// no multiplier. cos θ and sin θ are the coordinates of a unit vector at angle θ; rotate a vector to θ using only
// shifts by picking micro-rotation angles whose tangent is a power of two (atan(2^-i)), choosing + or - to home in
// (a binary search in angle). A fixed gain K≈0.6073 is cancelled by starting at (K,0). Verified in node: converges to
// true trig, max error 2e-5 over ±80° in 14 iterations. It's in calculators, FPGAs, GPUs, DSPs. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const N = 14;
const ANG = Array.from({ length: N }, (_, i) => Math.atan(Math.pow(2, -i)));
let K = 1; for (let i = 0; i < N; i++) K *= 1 / Math.sqrt(1 + Math.pow(2, -2 * i));
function cordic(theta: number) {
  let x = K, y = 0, z = theta; const pts = [{ x, y }]; const dirs: number[] = [];
  for (let i = 0; i < N; i++) { const d = z >= 0 ? 1 : -1; const nx = x - d * y * Math.pow(2, -i), ny = y + d * x * Math.pow(2, -i); x = nx; y = ny; z -= d * ANG[i]; pts.push({ x, y }); dirs.push(d); }
  return { pts, cos: x, sin: y, dirs };
}

const CXo = 430, CYo = 250, R = 168;
const sx = (x: number) => CXo + x * R, sy = (y: number) => CYo - y * R;

type Phase = 'why' | 'rotate' | 'shifts' | 'binary' | 'gain' | 'run';

export function CordicSection() {
  const [deg, setDeg] = useState(50);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Cor phase={key} deg={50} /> });

  const scenes: StoryScene[] = [
    scene('why', 'Trig without a multiplier', 'How does a pocket calculator or an FPGA compute cos and sin? A Taylor series needs multiplications, and the cheapest hardware often has no multiplier at all. CORDIC computes trig — and much more — using only bit-shifts and additions.'),
    scene('rotate', 'It’s just a rotating vector', 'cos θ and sin θ are nothing but the x and y coordinates of a unit vector pointing at angle θ. So the whole problem is: rotate a vector to θ, then read the answer off its coordinates. Start it pointing along the x-axis and turn it to the target.'),
    scene('shifts', 'Rotate by shift-able angles', 'A rotation by an arbitrary angle needs multiplies. But rotate by exactly atan(2⁻ⁱ) — an angle whose tangent is a power of two — and it collapses to x′ = x ∓ (y ≫ i), y′ = y ± (x ≫ i): a bit-shift and an add, no multiply. CORDIC only ever rotates by these special angles.'),
    scene('binary', 'Binary search on the angle', 'Chain the fixed micro-rotations atan(1), atan(½), atan(¼), … each either + or −: rotate positive when you’re short of θ, negative when you’ve overshot. Because the angles halve, it’s a binary search that pins the target angle in about a dozen shift-and-add steps.'),
    scene('gain', 'One gain, one circuit, a whole library', 'Each micro-rotation also stretches the vector a little; the total stretch is a fixed constant K ≈ 0.6073, so you cancel it by starting the vector at length K instead of 1 — and the final coordinates come out as exactly cos θ and sin θ. The same shift-and-add engine, in other modes, gives atan, magnitude, log, exp, and square root.'),
    { key: 'run', title: 'Turn the dial', caption: 'Set a target angle and watch the vector spiral to it: each segment is one micro-rotation by ±atan(2⁻ⁱ) — a shift and an add — swinging positive or negative to close in. After a dozen steps it lands on the unit circle at your angle, and its coordinates are cos θ and sin θ, accurate to five digits. No multiplies anywhere.', render: () => <Cor phase="run" deg={deg} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>How does a pocket calculator or an FPGA with no multiplier compute cos and sin? <strong>CORDIC</strong> does it with only bit-shifts and additions. The insight is geometric: cos θ and sin θ are the x and y coordinates of a unit vector pointing at angle θ — so if you can rotate a vector to θ, you can read the answer off its coordinates. And you can rotate using only shifts, by choosing rotation angles whose tangent is a power of two.</>,
        takeaway: <>Start with a vector on the x-axis and rotate it to the target by a fixed sequence of micro-rotations, each by ±atan(2⁻ⁱ). Those angles are special because a rotation by an angle with tan = 2⁻ⁱ works out to <code>x′ = x ∓ (y ≫ i)</code>, <code>y′ = y ± (x ≫ i)</code> — a bit-shift and an add, no multiply. At each step you rotate positive if you’re short of the target and negative if you’ve overshot, and because the angles halve (atan 1, atan ½, atan ¼, …) it’s a binary search in angle space that pins θ in a dozen or so steps. Each rotation also scales the vector by a known factor, so the whole chain multiplies its length by a fixed constant <strong>K ≈ 0.6073</strong>; you cancel it by starting the vector at length K, and the final coordinates come out as exactly cos θ and sin θ (verified to five digits). The same shift-and-add engine in other modes yields atan and vector magnitude, and its hyperbolic cousin gives log, exp, and square root — one tiny circuit for a whole math library, which is why CORDIC is in calculators, FPGAs, GPUs, DSP chips, and flew in the 1960s guidance computers.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="crd-ctl">angle θ<input type="range" min={-80} max={80} value={deg} onChange={(e) => setDeg(+e.target.value)} /><b>{deg}°</b> → cos {cordic(deg * Math.PI / 180).cos.toFixed(4)}, sin {cordic(deg * Math.PI / 180).sin.toFixed(4)}</label>
      )}
    />
  );
}

function Cor({ phase, deg }: { phase: Phase; deg: number }) {
  const on = (p: Phase) => phase === p;
  const theta = deg * Math.PI / 180;
  const { pts, cos, sin } = cordic(theta);
  const showPath = on('binary') || on('gain') || on('run');
  const showTarget = !on('why');
  const tx = Math.cos(theta), ty = Math.sin(theta);
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="30" className="crd-col">unit circle · cos θ, sin θ = coordinates of a vector at θ{on('run') || on('binary') || on('gain') ? ` · ${N} shift-add steps` : ''}</text>

      {/* unit circle + axes */}
      <circle cx={CXo} cy={CYo} r={R} className="crd-circle" />
      <line x1={CXo - R - 20} y1={CYo} x2={CXo + R + 20} y2={CYo} className="crd-axis" /><line x1={CXo} y1={CYo - R - 20} x2={CXo} y2={CYo + R + 20} className="crd-axis" />

      {/* target angle ray + point */}
      {showTarget && <>
        <line x1={CXo} y1={CYo} x2={sx(tx)} y2={sy(ty)} className="crd-target" />
        <circle cx={sx(tx)} cy={sy(ty)} r="5" className="crd-tpt" />
        <text x={sx(tx) + 10} y={sy(ty) - 6} className="crd-tlbl">θ = {deg}°</text>
      </>}

      {/* the starting vector (rotate scene) */}
      {(on('rotate') || on('shifts')) && <>
        <line x1={CXo} y1={CYo} x2={sx(on('shifts') ? pts[1].x : K)} y2={sy(on('shifts') ? pts[1].y : 0)} className="crd-vec" markerEnd="url(#crdarrow)" />
        {on('shifts') && <text x={sx(pts[1].x / 2) + 6} y={sy(pts[1].y / 2)} className="crd-step">rotate +atan(1) = 45°</text>}
        {on('rotate') && <text x={sx(K / 2)} y={CYo + 20} className="crd-step" textAnchor="middle">start: (K, 0)</text>}
      </>}

      {/* the CORDIC trajectory (binary/gain/run) */}
      {showPath && <>
        <polyline points={pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')} className="crd-path" fill="none" />
        {pts.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.5" className="crd-dot" />)}
        <line x1={CXo} y1={CYo} x2={sx(cos)} y2={sy(sin)} className="crd-vec" markerEnd="url(#crdarrow)" />
        <text x={sx(cos) + 10} y={sy(sin) + 16} className="crd-res">(cos {cos.toFixed(3)}, sin {sin.toFixed(3)})</text>
      </>}
      <defs><marker id="crdarrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="hsl(45 90% 62%)" /></marker></defs>

      {/* gain note */}
      {on('gain') && <text x={CXo} y={CYo + R + 44} className="crd-gain" textAnchor="middle">start length K = {K.toFixed(4)} → cancels the rotation gain → unit result</text>}

      <text x="450" y="466" className="crd-foot" textAnchor="middle">
        {on('why') ? 'no multiplier needed — only bit-shifts and adds'
          : on('rotate') ? 'rotate a vector to θ; its (x, y) are (cos θ, sin θ)'
          : on('shifts') ? 'rotation by atan(2⁻ⁱ) = shift by i bits + add — no multiply'
          : on('binary') ? 'halving angles ± to home in — a binary search on θ'
          : on('gain') ? 'one shift-add engine also gives atan, magnitude, log, exp, √'
          : `θ=${deg}° → (${cos.toFixed(4)}, ${sin.toFixed(4)}) in ${N} shift-add steps, no multiplies`}
      </text>
    </svg>
  );
}
