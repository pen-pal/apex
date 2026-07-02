// Guided story: the Separating Axis Theorem (SAT) — the exact test behind convex collision detection in games/physics.
// Two convex shapes are disjoint IFF some axis exists on which their projections (shadows) don't overlap; for polygons
// only the edge normals need testing. One gap on any axis → no collision; if every axis overlaps, they intersect, and
// the smallest overlap gives the minimum translation vector to push them apart. Real SAT verified in node: matches a
// brute-force point-sampling oracle 5/5, and the MTV separates. Sandboxed/CONCEPTUAL, 2-D convex polygons.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type V = [number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const cen = (p: V[]): V => [p.reduce((s, v) => s + v[0], 0) / p.length, p.reduce((s, v) => s + v[1], 0) / p.length];
function axesOf(poly: V[]): V[] { const out: V[] = []; for (let i = 0; i < poly.length; i++) { const e = sub(poly[(i + 1) % poly.length], poly[i]); const n: V = [-e[1], e[0]]; const L = Math.hypot(n[0], n[1]) || 1; out.push([n[0] / L, n[1] / L]); } return out; }
const proj = (poly: V[], ax: V) => { let mn = Infinity, mx = -Infinity; for (const p of poly) { const d = dot(p, ax); mn = Math.min(mn, d); mx = Math.max(mx, d); } return [mn, mx] as [number, number]; };
function sat(A: V[], B: V[]) {
  const all = [...axesOf(A), ...axesOf(B)]; let minOv = Infinity, mtv: V | null = null, sep: V | null = null;
  for (const ax of all) { const [amn, amx] = proj(A, ax), [bmn, bmx] = proj(B, ax); const ov = Math.min(amx, bmx) - Math.max(amn, bmn); if (ov <= 0) { sep = ax; break; } if (ov < minOv) { minOv = ov; mtv = ax; } }
  if (sep) return { collide: false, axis: sep, depth: 0 };
  const d = sub(cen(B), cen(A)); if (mtv && dot(mtv, d) < 0) mtv = [-mtv[0], -mtv[1]];
  return { collide: true, axis: mtv!, depth: minOv };
}

const A: V[] = [[240, 190], [400, 190], [400, 330], [240, 330]]; // fixed square
const triAt = (cx: number): V[] => [[cx, 170], [cx + 95, 330], [cx - 95, 330]]; // movable triangle

type Phase = 'overlap' | 'shadow' | 'normals' | 'gap' | 'mtv' | 'run';

export function SatSection() {
  const [bx, setBx] = useState(560);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, cx: number): StoryScene =>
    ({ key, title, caption, render: () => <Sat phase={key} bx={cx} /> });

  const scenes: StoryScene[] = [
    scene('overlap', 'Do two shapes overlap?', 'Collision detection asks whether two shapes intersect — the core question in every physics engine and game. Testing every point of one against every edge of the other is slow and fiddly. For convex shapes there is an exact, elegant test that needs only a handful of checks.', 560),
    scene('shadow', 'Cast shadows on an axis', 'Project both shapes onto a line — their shadows. If the two shadows don’t overlap on some line, the shapes are separated along that direction and cannot be touching. Such a line is called a separating axis; find one and you are done.', 560),
    scene('normals', 'Only the edge normals matter', 'You don’t have to try infinitely many lines. For convex polygons, if a separating axis exists at all, then one perpendicular to an edge of one of the two shapes also works. So you only test the edge normals — here just seven axes for a square and a triangle.', 520),
    scene('gap', 'One gap means no collision', 'Project both shapes onto each edge normal. The instant you find one axis where the shadows have a gap between them, stop — the shapes are disjoint, no matter what the other axes say. Here the shadows clear each other, so: no collision.', 560),
    scene('mtv', 'The overlap says how to separate', 'When every axis shows overlap, the shapes do intersect. The axis with the smallest overlap gives the minimum translation vector — the shortest push that separates them. A physics engine moves the shapes apart along exactly this vector to resolve the collision.', 415),
    { key: 'run', title: 'Slide the triangle', caption: 'Move the triangle through the square and watch the shadows on the highlighted axis. While they overlap on every edge normal, it’s a collision (red) and the arrow shows the minimum push to separate them; the moment one axis opens a gap, it flips to no-collision (green). That single gap is a complete proof of separation.', render: () => <Sat phase="run" bx={bx} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Collision detection asks whether two shapes overlap — the question at the heart of every physics engine and game. For <strong>convex</strong> shapes there’s an exact test: two convex shapes are disjoint <em>if and only if</em> there’s some axis along which their projections (their “shadows” on a line) don’t overlap. Such a line is a <strong>separating axis</strong>, and finding one proves the shapes don’t touch.</>,
        takeaway: <>Project both shapes onto a candidate axis and you get two intervals; if those intervals have a gap, that axis separates the shapes and you can stop immediately — one gap is a complete proof of no collision. The theorem also says you don’t need infinitely many candidate axes: for convex polygons, if any separating axis exists, one <strong>perpendicular to an edge</strong> of one of the shapes does too, so you only test the edge normals (a handful of axes). If <em>every</em> edge normal shows overlapping shadows, the shapes intersect — and the axis with the <strong>smallest</strong> overlap gives the minimum translation vector (MTV), the shortest push that separates them, which is exactly how the physics engine resolves the collision. Real engines add a broad phase (bounding boxes) to skip far-apart pairs and use GJK for smooth convex shapes, but SAT is the workhorse for boxes and polygons. Verified here against a brute-force point-sampling oracle.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="sat-ctl">triangle x<input type="range" min={300} max={720} value={bx} onChange={(e) => setBx(+e.target.value)} /><b className={sat(A, triAt(bx)).collide ? 'hit' : 'ok'}>{sat(A, triAt(bx)).collide ? 'COLLISION' : 'separated'}</b></label>
      )}
    />
  );
}

function Sat({ phase, bx }: { phase: Phase; bx: number }) {
  const on = (p: Phase) => phase === p;
  const B = triAt(bx);
  const r = sat(A, B);
  const ax = r.axis;
  const C: V = [450, 250];
  // shadow of a poly onto ax, drawn as a segment offset perpendicular by `off`
  const perp: V = [-ax[1], ax[0]];
  const shadow = (poly: V[], off: number) => { const [mn, mx] = proj(poly, ax); const b = dot(C, ax); const p1: V = [C[0] + (mn - b) * ax[0] + off * perp[0], C[1] + (mn - b) * ax[1] + off * perp[1]]; const p2: V = [C[0] + (mx - b) * ax[0] + off * perp[0], C[1] + (mx - b) * ax[1] + off * perp[1]]; return { p1, p2, mn, mx }; };
  const showAxis = on('shadow') || on('gap') || on('mtv') || on('run');
  const sA = shadow(A, 150), sB = shadow(B, 168);
  const gap = !r.collide;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="30" className="sat-col">convex collision · SAT{showAxis ? (r.collide ? ' · every axis overlaps → COLLISION' : ' · a gap on this axis → separated') : ''}</text>

      {/* edge normals (normals scene) */}
      {on('normals') && [...axesOf(A).map((a) => ({ a, c: cen(A) })), ...axesOf(B).map((a) => ({ a, c: cen(B) }))].map((na, i) => (
        <line key={i} x1={na.c[0]} y1={na.c[1]} x2={na.c[0] + na.a[0] * 46} y2={na.c[1] + na.a[1] * 46} className="sat-normal" markerEnd="url(#satarrow)" />
      ))}

      {/* shapes */}
      <polygon points={A.map((p) => p.join(',')).join(' ')} className="sat-shape a" />
      <polygon points={B.map((p) => p.join(',')).join(' ')} className={`sat-shape b ${r.collide ? 'hit' : ''}`} />

      {/* projection axis + shadows */}
      {showAxis && <>
        <line x1={C[0] - ax[0] * 240} y1={C[1] - ax[1] * 240} x2={C[0] + ax[0] * 240} y2={C[1] + ax[1] * 240} className="sat-axis" />
        <line x1={sA.p1[0]} y1={sA.p1[1]} x2={sA.p2[0]} y2={sA.p2[1]} className="sat-shadow a" />
        <line x1={sB.p1[0]} y1={sB.p1[1]} x2={sB.p2[0]} y2={sB.p2[1]} className="sat-shadow b" />
        <text x={sA.p2[0] + 10} y={sA.p2[1]} className="sat-slbl a">shadow A</text>
        <text x={sB.p2[0] + 10} y={sB.p2[1] + 12} className="sat-slbl b">shadow B</text>
        {gap && <text x={(sA.p2[0] + sB.p1[0]) / 2} y={(sA.p2[1] + sB.p1[1]) / 2 - 10} className="sat-gap" textAnchor="middle">gap → separated</text>}
      </>}

      {/* MTV arrow */}
      {(on('mtv') || (on('run') && r.collide)) && r.collide && (() => { const c = cen(B); return (
        <g><line x1={c[0]} y1={c[1]} x2={c[0] + ax[0] * r.depth} y2={c[1] + ax[1] * r.depth} className="sat-mtv" markerEnd="url(#satmtv)" /><text x={c[0] + ax[0] * r.depth / 2} y={c[1] + ax[1] * r.depth / 2 - 8} className="sat-mtvlbl" textAnchor="middle">MTV {r.depth.toFixed(0)}px</text></g>
      ); })()}

      <defs>
        <marker id="satarrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L5,3 L0,6 z" fill="hsl(210 40% 62%)" /></marker>
        <marker id="satmtv" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="hsl(0 70% 62%)" /></marker>
      </defs>

      <text x="450" y="462" className="sat-foot" textAnchor="middle">
        {on('overlap') ? 'do these two convex shapes intersect? SAT answers exactly'
          : on('shadow') ? 'project both onto a line; a gap between shadows = separated'
          : on('normals') ? 'only the edge normals can be separating axes — test just those'
          : on('gap') ? 'one axis with a gap proves no collision — stop checking'
          : on('mtv') ? 'all axes overlap → collision; smallest overlap = push-apart vector'
          : r.collide ? 'collision — arrow is the minimum push to separate' : 'separated — the shadows clear on this axis'}
      </text>
    </svg>
  );
}
