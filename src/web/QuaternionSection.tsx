// Guided story: quaternions & slerp — how 3D rotation is really stored. Euler angles (yaw/pitch/roll) hit gimbal lock;
// a unit quaternion q = cos(θ/2) + sin(θ/2)·axis is a point on the 4-sphere with no gimbal lock, rotates a vector by the
// sandwich v' = q v q⁻¹, and slerp blends two orientations along the shortest great-circle arc at constant angular
// velocity. Verified in node: quat→matrix == Rodrigues axis-angle to 1e-15, v'=qvq⁻¹ == R·v, slerp stays unit-norm and
// moves at constant speed. Why game engines, robotics, and IMU fusion store orientation as quaternions. Sandboxed.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type V3 = [number, number, number]; type Mat = number[][]; type Quat = [number, number, number, number];
const mul = (A: Mat, B: Mat): Mat => A.map((r) => B[0].map((_, j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (M: Mat, v: V3): V3 => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const Rx = (a: number): Mat => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const Ry = (a: number): Mat => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const Rz = (a: number): Mat => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const eulerMat = (yaw: number, pitch: number, roll: number) => mul(mul(Ry(yaw), Rx(pitch)), Rz(roll));
const norm4 = (q: Quat): Quat => { const n = Math.hypot(...q); return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]; };
const fromAxisAngle = (ax: V3, th: number): Quat => { const h = th / 2, s = Math.sin(h); return [Math.cos(h), ax[0] * s, ax[1] * s, ax[2] * s]; };
const qmat = (q: Quat): Mat => { const [w, x, y, z] = q; return [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]]; };
const dot4 = (a: Quat, b: Quat) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
function slerp(q0: Quat, q1: Quat, t: number): Quat { let d = dot4(q0, q1); if (d < 0) { q1 = q1.map((x) => -x) as Quat; d = -d; } if (d > 0.9995) return norm4(q0.map((x, i) => x + t * (q1[i] - x)) as Quat); const O = Math.acos(d), s = Math.sin(O); return q0.map((x, i) => (Math.sin((1 - t) * O) * x + Math.sin(t * O) * q1[i]) / s) as Quat; }

// object: unit cube (edges) + a triad of axis arrows
const CUBE: V3[] = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const EDGES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const AXES: { v: V3; c: string; l: string }[] = [{ v: [1.7, 0, 0], c: '#e5484d', l: 'X' }, { v: [0, 1.7, 0], c: '#46a758', l: 'Y' }, { v: [0, 0, 1.7], c: '#3b82f6', l: 'Z' }];
const VIEW = mul(Rx(-0.45), Ry(0.7)); // fixed 3/4 camera
const CX = 250, CY = 165, SCALE = 52;
const proj = (p: V3, R: Mat): [number, number, number] => { const w = mv(VIEW, mv(R, p)); return [CX + w[0] * SCALE, CY - w[1] * SCALE, w[2]]; };

// two orientation poses for the blend
const POSE_A = fromAxisAngle([0, 1, 0], -1.1);
const POSE_B = fromAxisAngle(norm3([0.3, 0.6, 0.8]), 2.4);
function norm3(v: V3): V3 { const n = Math.hypot(...v); return [v[0] / n, v[1] / n, v[2] / n]; }
// Euler angles roughly matching A and B, for the naive-lerp comparison
const EA: V3 = [-1.1, 0, 0], EB: V3 = [1.6, 1.4, 1.0];

type Phase = 'euler' | 'gimbal' | 'quat' | 'exact' | 'slerp' | 'run';

export function QuaternionSection() {
  const [t, setT] = useState(0.35); const [mode, setMode] = useState<'quat' | 'euler'>('quat');
  const auto = useRef(0); const dir = useRef(1); const [, tick] = useState(0);
  useEffect(() => { let raf = 0; const loop = () => { auto.current += dir.current * 0.006; if (auto.current > 1) { auto.current = 1; dir.current = -1; } else if (auto.current < 0) { auto.current = 0; dir.current = 1; } tick((x) => (x + 1) % 100000); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Q phase={key} t={auto.current} mode={key === 'euler' || key === 'gimbal' ? 'euler' : 'quat'} /> });

  const scenes: StoryScene[] = [
    scene('euler', 'Rotation, the intuitive way', 'The obvious way to orient something in 3D is three angles — yaw, pitch, roll — applied in order. It’s how we describe a plane’s attitude, and it reads naturally. But storing a rotation as three sequential turns hides a trap that shows up at the extremes.'),
    scene('gimbal', 'Gimbal lock', 'Push the pitch toward 90° and the outer (yaw) axis and the inner (roll) axis line up — they now spin the object the same way. Three angles, but only two independent directions of motion: a degree of freedom has collapsed. Near this pose, orientations that should be close need wild angle swings, and animation stutters.'),
    scene('quat', 'A rotation is a point on a 4-sphere', 'A quaternion drops the three-angle idea entirely. A rotation by angle θ about a unit axis is q = cos(θ/2) + sin(θ/2)·(axis) — four numbers on the unit sphere in 4D. It rotates a vector by the sandwich product v′ = q·v·q⁻¹. One smooth object, one axis, any angle — and no orientation is special, so there’s no gimbal lock.'),
    scene('exact', 'The same rotation, exactly', 'This isn’t an approximation of “real” rotation — expand q·v·q⁻¹ and you get precisely the axis-angle rotation matrix from Rodrigues’ formula (verified to 1e-15). Quaternions also compose by multiplication — cheaper and more numerically stable than multiplying 3×3 matrices — and a quick renormalize cancels any drift.'),
    scene('slerp', 'Slerp: the shortest smooth blend', 'The real win is blending two orientations. Slerp walks the great-circle arc between the two quaternions on the 4-sphere: it stays on the sphere (always a valid rotation) and moves at constant angular velocity, so a camera or a joint eases from pose A to pose B without speeding up, stalling, or taking the long way. Because q and −q are the same rotation, it flips to the nearer one to keep the arc short.'),
    { key: 'run', title: 'Blend two orientations', caption: 'Drag t to blend from pose A to pose B, and toggle how. Quaternion slerp glides smoothly along the shortest arc at even speed. Naïve Euler-angle interpolation — lerping yaw/pitch/roll — wobbles, changes speed, and can swing the long way round or through a gimbal-locked pose. Same endpoints, very different journey; that’s why engines store quaternions.', render: () => <Q phase="run" t={t} mode={mode} onT={setT} onMode={setMode} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Rotating something in 3D seems simple until you try to store and blend rotations. <strong>Euler angles</strong> (yaw, pitch, roll) are intuitive but hit <strong>gimbal lock</strong> — at certain angles two axes line up and a degree of freedom vanishes, so rotation jerks or freezes. A <strong>quaternion</strong> sidesteps this by representing a rotation as a single point on the unit 4-sphere — a scalar plus a 3-vector encoding an axis and half-angle — and <strong>slerp</strong> blends two of them smoothly along the shortest arc.</>,
        takeaway: <>A 3D rotation has three degrees of freedom, but every minimal representation has a catch. <strong>Euler angles</strong> (three sequential axis rotations) suffer <strong>gimbal lock</strong>: when the middle rotation reaches ±90°, the first and third axes coincide, collapsing two of the three degrees of freedom, so near that pose small orientation changes need huge angle swings and interpolation stutters. A <strong>unit quaternion</strong> q = w + xi + yj + zk (with w² + x² + y² + z² = 1) represents a rotation by angle θ about unit axis â as q = cos(θ/2) + sin(θ/2)â — a point on the unit 3-sphere S³ in 4D. It rotates a vector v by the sandwich product v′ = q·v·q⁻¹, which expands to exactly the same 3×3 matrix as the axis-angle <strong>Rodrigues</strong> formula (verified here to 1e-15). Quaternions have no gimbal lock, compose by multiplication (cheaper and more stable than matrix products), and renormalize trivially against drift. Their real advantage is smooth interpolation: <strong>slerp</strong> walks the great-circle arc between two orientations, slerp(q₀,q₁,t) = [sin((1−t)Ω)q₀ + sin(tΩ)q₁]/sin Ω with cos Ω = q₀·q₁ — which stays on the unit sphere (still a valid rotation) and moves at <em>constant angular velocity</em> (verified: equal angle per equal t step), so a camera or a character’s joints blend between poses without speeding up, slowing, or taking the long way. Because q and −q are the same rotation, implementations flip to the nearer one so slerp takes the short arc. This is why game engines, robotics, spacecraft attitude control, and IMU sensor fusion all store orientation as quaternions, reserving Euler angles for the final human-readable display.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="qt-ctl">
          <label>blend t <input type="range" min={0} max={1} step={0.01} value={t} onChange={(e) => setT(+e.target.value)} /><b>{t.toFixed(2)}</b></label>
          <button type="button" className={`qt-btn ${mode === 'quat' ? 'on' : ''}`} onClick={() => setMode('quat')}>quaternion slerp</button>
          <button type="button" className={`qt-btn ${mode === 'euler' ? 'on' : ''}`} onClick={() => setMode('euler')}>Euler lerp</button>
        </div>
      )}
    />
  );
}

function Q({ phase, t, mode, onT, onMode }: { phase: Phase; t: number; mode: 'quat' | 'euler'; onT?: (t: number) => void; onMode?: (m: 'quat' | 'euler') => void }) {
  const on = (p: Phase) => phase === p;
  void onT; void onMode;
  // orientation for this frame (narrated scenes pass the auto-swept value; run passes the slider)
  const tt = t;
  const R = useMemo(() => {
    if (on('euler')) { const a = 0.3 + tt * 0.9; return eulerMat(a * 1.2, a * 0.7, a); }
    if (on('gimbal')) { const pitch = tt * (Math.PI / 2); return eulerMat(0.6, pitch, 0.9); }
    if (on('quat')) return qmat(fromAxisAngle(norm3([0.3, 1, 0.5]), 0.4 + tt * 3.2));
    if (on('exact')) return qmat(fromAxisAngle(norm3([1, 0.5, 0.2]), 0.4 + tt * 2.4));
    // slerp / run
    if (mode === 'euler') { const e: V3 = [EA[0] + (EB[0] - EA[0]) * tt, EA[1] + (EB[1] - EA[1]) * tt, EA[2] + (EB[2] - EA[2]) * tt]; return eulerMat(e[0], e[1], e[2]); }
    return qmat(slerp(POSE_A, POSE_B, tt));
  }, [phase, tt, mode]);

  // gimbal-lock axis check: yaw axis (world Y) vs roll axis (after yaw+pitch)
  const pitch = tt * (Math.PI / 2);
  const yawAxis: V3 = [0, 1, 0];
  const rollAxis = mv(mul(Ry(0.6), Rx(pitch)), [0, 0, 1]);
  const align = Math.abs(yawAxis[0] * rollAxis[0] + yawAxis[1] * rollAxis[1] + yawAxis[2] * rollAxis[2]); // →1 at lock
  const locked = on('gimbal') && align > 0.9;

  const pc = CUBE.map((p) => proj(p, R));
  return (
    <svg viewBox="0 0 900 330" className="story-svg">
      <text x="60" y="24" className="qt-col">{on('euler') || on('gimbal') ? 'Euler angles (yaw · pitch · roll)' : on('slerp') || on('run') ? `blend A→B · ${mode === 'quat' ? 'quaternion slerp' : 'Euler lerp'} · t=${tt.toFixed(2)}` : 'quaternion  q = cos(θ/2) + sin(θ/2)·â'}</text>

      {/* cube edges */}
      {EDGES.map(([a, b], i) => <line key={i} x1={pc[a][0]} y1={pc[a][1]} x2={pc[b][0]} y2={pc[b][1]} className="qt-edge" />)}
      {/* triad axes */}
      {AXES.map((ax, i) => { const o = proj([0, 0, 0], R), e = proj(ax.v, R); return <g key={i}><line x1={o[0]} y1={o[1]} x2={e[0]} y2={e[1]} stroke={ax.c} strokeWidth={2.5} /><circle cx={e[0]} cy={e[1]} r={4} fill={ax.c} /><text x={e[0] + 6} y={e[1] + 4} fill={ax.c} className="qt-axl">{ax.l}</text></g>; })}

      {/* gimbal-lock: draw the yaw & roll rotation axes; flash when aligned */}
      {on('gimbal') && <>{[{ a: yawAxis, c: '#f5d90a', l: 'yaw axis' }, { a: rollAxis as V3, c: '#e5484d', l: 'roll axis' }].map((r, i) => { const o = proj([0, 0, 0], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]); const e = proj(r.a.map((x) => x * 2.1) as V3, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]); return <g key={i}><line x1={o[0]} y1={o[1]} x2={e[0]} y2={e[1]} stroke={r.c} strokeWidth={locked ? 4 : 2} strokeDasharray="5 3" /><text x={e[0] + 4} y={e[1] + (i ? 14 : -4)} fill={r.c} className="qt-axl">{r.l}</text></g>; })}
        {locked && <text x={CX} y={300} className="qt-lock" textAnchor="middle">⚠ GIMBAL LOCK — yaw and roll now rotate the object the same way (a DOF lost)</text>}</>}

      {/* the 4-sphere / slerp mini-diagram on the right */}
      {(on('quat') || on('exact') || on('slerp') || on('run')) && <SphereArc phase={phase} t={tt} mode={mode} />}

      <text x="450" y="322" className="qt-foot" textAnchor="middle">
        {on('euler') ? 'three sequential turns — intuitive, but watch the extremes'
          : on('gimbal') ? (locked ? 'two axes coincide → one rotation direction is unreachable' : 'raise pitch toward 90° and the axes converge')
          : on('quat') ? 'v′ = q·v·q⁻¹ — one axis, any angle, no special poses'
          : on('exact') ? 'q·v·q⁻¹ expands to the Rodrigues matrix, exactly (1e-15)'
          : on('slerp') ? 'great-circle arc on the sphere → constant-speed blend'
          : mode === 'quat' ? 'smooth, even-speed, shortest arc' : 'wobbles, uneven speed, can swing the long way'}
      </text>
    </svg>
  );
}

// right-side schematic: a circle (the 4-sphere, drawn as a great circle) with q0, q1 and the moving slerp point
function SphereArc({ phase, t, mode }: { phase: Phase; t: number; mode: 'quat' | 'euler' }) {
  const cx = 660, cy = 160, r = 92;
  const A0 = -0.9, A1 = 1.7; // angles of q0,q1 on the drawn great circle
  const ptAt = (ang: number) => [cx + Math.cos(ang) * r, cy - Math.sin(ang) * r];
  const q0 = ptAt(A0), q1 = ptAt(A1);
  // slerp: constant speed along the arc; euler-lerp: chord (uneven, cuts inside)
  const cur = mode === 'quat' ? ptAt(A0 + (A1 - A0) * t) : [q0[0] + (q1[0] - q0[0]) * t, q0[1] + (q1[1] - q0[1]) * t];
  const arc = Array.from({ length: 33 }, (_, i) => ptAt(A0 + (A1 - A0) * (i / 32)));
  return <g>
    <circle cx={cx} cy={cy} r={r} className="qt-sphere" />
    <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.34} className="qt-sphere2" />
    <polyline points={arc.map((p) => `${p[0]},${p[1]}`).join(' ')} className="qt-arc" fill="none" />
    {(phase === 'slerp' || (phase === 'run' && mode === 'euler')) && <line x1={q0[0]} y1={q0[1]} x2={q1[0]} y2={q1[1]} className="qt-chord" />}
    <circle cx={q0[0]} cy={q0[1]} r={5} className="qt-pt" /><text x={q0[0] - 6} y={q0[1] - 8} className="qt-ptl">A</text>
    <circle cx={q1[0]} cy={q1[1]} r={5} className="qt-pt" /><text x={q1[0] + 6} y={q1[1] - 8} className="qt-ptl">B</text>
    <circle cx={cur[0]} cy={cur[1]} r={6} className={`qt-cur ${mode}`} />
    <text x={cx} y={cy + r + 22} className="qt-slbl" textAnchor="middle">the unit 4-sphere (S³) — every point is a rotation</text>
  </g>;
}
