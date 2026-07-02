// Guided story: ray-marching a signed distance field (sphere tracing) — the technique behind Shadertoy and demoscene
// intros. Define the scene as a function: for any point, the distance to the nearest surface (a sphere is |p−c|−r).
// To render, march a ray and step forward by the SDF value each time — safe, because nothing is closer than that. Big
// steps in open space, small steps near surfaces; converges in a handful of iterations. Real sphere tracing verified
// in node (grazing ray hits in 7 steps 336→32→…→0; head-on in 4; a high ray misses). Sandboxed/CONCEPTUAL, 2-D slice.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const SCENE = [{ c: [600, 220] as [number, number], r: 95 }, { c: [470, 330] as [number, number], r: 55 }];
const sdf = (p: number[]) => Math.min(...SCENE.map((s) => Math.hypot(p[0] - s.c[0], p[1] - s.c[1]) - s.r));
const O: [number, number] = [80, 360];
function march(angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180, D = [Math.cos(a), Math.sin(a)];
  let t = 0; const steps: { p: number[]; d: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const p = [O[0] + t * D[0], O[1] + t * D[1]]; const d = sdf(p); steps.push({ p, d });
    if (d < 0.6) return { hit: true, steps, end: p };
    if (t > 1300 || p[0] > 900 || p[1] < -50 || p[1] > 520) return { hit: false, steps, end: p };
    t += d;
  }
  return { hit: false, steps, end: steps[steps.length - 1].p };
}

type Phase = 'field' | 'march' | 'steps' | 'free' | 'used' | 'run';

export function RayMarchSection() {
  const [angle, setAngle] = useState(-15);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <RM phase={key} angle={-15} /> });

  const scenes: StoryScene[] = [
    scene('field', 'A scene is a math function', 'Instead of triangles, ray-marching defines the world as a signed distance function: give it any point and it returns the distance to the nearest surface — negative inside, zero on it, positive outside. A sphere is just the length of (point − centre) minus its radius. The circle drawn around a point is exactly that distance: the largest empty space around it.'),
    scene('march', 'March a ray by the distance', 'To find where a ray hits, step along it. The clever move: the distance function tells you how far the nearest surface is, so you can safely jump forward by exactly that much without passing through anything. That first step is huge because the ray starts far from everything.'),
    scene('steps', 'Big steps in space, small near surfaces', 'Each step is the SDF value — the radius of the largest empty sphere around you. Far from everything you leap; as you approach a surface the empty sphere shrinks, so the steps shrink, and you converge onto the surface in a handful of iterations. Stop when the distance drops below a tiny epsilon: that’s a hit.'),
    scene('free', 'The field gives you everything', 'Because the scene is a continuous function, things that are painful with meshes come almost free: the surface normal is the gradient of the field (for lighting), and constructive solid geometry is trivial — the min of two distance fields is their union, the max is their intersection, a negation is subtraction. Soft shadows and ambient occlusion fall out of sampling the field too.'),
    scene('used', 'Worlds from a few lines of math', 'This is how Shadertoy scenes and demoscene 4-kilobyte intros render entire worlds with no meshes — exact curves, infinite resolution, from a handful of distance functions combined. The price is evaluating the field many times per pixel, which is why it lives on the GPU.'),
    { key: 'run', title: 'Aim the ray', caption: 'Sweep the ray’s angle and watch it march. Aimed at open space it takes one giant leap; aimed near a surface it creeps in with shrinking steps and converges (green hit); aimed past everything it marches off into the void (a miss). Each circle is the empty sphere the SDF guarantees at that point.', render: () => <RM phase="run" angle={angle} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Instead of building a scene from triangles, ray-marching defines it as a <strong>signed distance function</strong>: for any point in space it returns the distance to the nearest surface (negative inside, zero on it). A sphere is just the length of (point − centre) minus its radius. To render, you shoot a ray per pixel and march along it — and the elegant part is that the distance function itself tells you how far you can safely step.</>,
        takeaway: <>The march is called <strong>sphere tracing</strong>: at each point on the ray, evaluate the distance function; its value is the radius of the largest empty sphere around you, so you can jump forward by exactly that far without passing through any surface. Far from everything you take big steps; as you approach, the steps shrink and you converge onto the surface in a handful of iterations (stop when the distance drops below a small epsilon — a hit — or when you’ve marched too far — a miss). Because the whole scene is a continuous function, things that are painful with meshes come almost free: the surface <strong>normal</strong> is the gradient of the field (finite differences), <strong>constructive solid geometry</strong> is trivial (min of two fields = union, max = intersection, negation = subtraction), <strong>soft shadows</strong> fall out of tracking a shadow ray’s closest approach, and <strong>ambient occlusion</strong> from sampling the field nearby. It’s the technique behind Shadertoy, demoscene 4 KB intros, and many volumetric and soft effects — entire worlds from a few lines of math at any resolution, the price being many field evaluations per pixel, which is why it runs on the GPU.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="rm-ctl">ray angle<input type="range" min={-45} max={12} value={angle} onChange={(e) => setAngle(+e.target.value)} /><b>{angle}°</b> · {march(angle).hit ? `hit in ${march(angle).steps.length} steps` : 'miss'}</label>
      )}
    />
  );
}

function RM({ phase, angle }: { phase: Phase; angle: number }) {
  const on = (p: Phase) => phase === p;
  const m = march(angle);
  const showMarch = !on('field');
  const shown = on('march') ? m.steps.slice(0, 2) : m.steps;
  // normal at hit (gradient)
  let normal: number[] | null = null;
  if ((on('free') || on('run')) && m.hit) { const p = m.end; const e = 1; normal = [sdf([p[0] + e, p[1]]) - sdf([p[0] - e, p[1]]), sdf([p[0], p[1] + e]) - sdf([p[0], p[1] - e])]; const L = Math.hypot(...normal) || 1; normal = [normal[0] / L, normal[1] / L]; }
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="30" className="rm-col">ray-marching a distance field — 2-D slice · {on('field') ? 'SDF = distance to nearest surface' : m.hit ? `hit in ${m.steps.length} steps` : 'miss'}</text>

      {/* scene surfaces */}
      {SCENE.map((s, i) => <circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.r} className="rm-surf" />)}

      {/* SDF illustration: a sample point + its empty sphere */}
      {on('field') && (() => { const sp = [300, 200]; const d = sdf(sp); return (
        <g><circle cx={sp[0]} cy={sp[1]} r={d} className="rm-empty" /><circle cx={sp[0]} cy={sp[1]} r="4" className="rm-pt" /><text x={sp[0]} y={sp[1] - d - 8} className="rm-lbl" textAnchor="middle">distance to nearest = {d.toFixed(0)}</text></g>
      ); })()}

      {/* eye */}
      <circle cx={O[0]} cy={O[1]} r="6" className="rm-eye" /><text x={O[0]} y={O[1] + 22} className="rm-lbl" textAnchor="middle">ray</text>

      {/* march: step circles + points + ray segments */}
      {showMarch && <>
        {shown.map((st, i) => <circle key={'c' + i} cx={st.p[0]} cy={st.p[1]} r={Math.max(0, st.d)} className="rm-empty" />)}
        <polyline points={[O, ...shown.map((s) => s.p), m.end].map((p) => `${p[0].toFixed(0)},${p[1].toFixed(0)}`).join(' ')} className="rm-ray" fill="none" />
        {shown.map((st, i) => <circle key={'p' + i} cx={st.p[0]} cy={st.p[1]} r="3.5" className="rm-pt" />)}
        {m.hit && <circle cx={m.end[0]} cy={m.end[1]} r="7" className="rm-hit" />}
        {normal && <line x1={m.end[0]} y1={m.end[1]} x2={m.end[0] + normal[0] * 44} y2={m.end[1] + normal[1] * 44} className="rm-normal" markerEnd="url(#rmarrow)" />}
      </>}
      <defs><marker id="rmarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="hsl(150 65% 58%)" /></marker></defs>

      <text x="450" y="452" className="rm-foot" textAnchor="middle">
        {on('field') ? 'the world is a function: point → distance to the nearest surface'
          : on('march') ? 'step forward by the SDF value — nothing is closer, so it’s safe'
          : on('steps') ? 'steps shrink near the surface; a few iterations converge to the hit'
          : on('free') ? 'normal = gradient of the field; union = min, intersection = max — for free'
          : on('used') ? 'no meshes: exact curves at any resolution, from a few distance functions'
          : m.hit ? 'green = converged hit; each circle is the guaranteed empty space' : 'marched past everything — a miss'}
      </text>
    </svg>
  );
}
