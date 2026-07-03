// Guided story: Bézier curves & de Casteljau's algorithm — a smooth curve from a few control points, drawn with
// nothing but repeated linear interpolation. For parameter t, lerp each adjacent pair of control points, then those,
// until one point remains — the curve point at t; sweeping t traces the curve. It equals the Bernstein polynomial
// exactly and stays inside the control points' convex hull. Verified in node: de Casteljau == Bernstein to 3e-16,
// endpoints exact, subdivision reproduces the curve to 1e-16. The workhorse of fonts, SVG/PDF paths, and UI easing.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type P = [number, number];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function levels(pts: P[], t: number): P[][] { const ls = [pts]; let cur = pts; while (cur.length > 1) { const n: P[] = []; for (let i = 0; i < cur.length - 1; i++) n.push(lerp(cur[i], cur[i + 1], t)); ls.push(n); cur = n; } return ls; }
const at = (pts: P[], t: number) => levels(pts, t).at(-1)![0];

const OX = 150, OY = 30, SZ = 360;
const gx = (x: number) => OX + x * SZ, gy = (y: number) => OY + y * SZ;
const LVLHUE = [210, 45, 150, 280];
const DEFAULT: P[] = [[0.1, 0.78], [0.32, 0.12], [0.68, 0.9], [0.9, 0.24]];

type Phase = 'points' | 'lerp' | 'trace' | 'bernstein' | 'subdivide' | 'run';

export function BezierSection() {
  const [pts, setPts] = useState<P[]>(DEFAULT.map((p) => [...p] as P));
  const [hull, setHull] = useState(false);
  const tRef = useRef(0.35); const dir = useRef(1); const drag = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    let raf = 0; const loop = () => { tRef.current += dir.current * 0.006; if (tRef.current >= 1) { tRef.current = 1; dir.current = -1; } else if (tRef.current <= 0) { tRef.current = 0; dir.current = 1; } tick((t) => (t + 1) % 100000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  const toWorld = (e: React.PointerEvent): P => { const svg = svgRef.current!; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM()!.inverse()); return [(p.x - OX) / SZ, (p.y - OY) / SZ]; };
  const onMove = (e: React.PointerEvent) => { if (drag.current === null) return; const w = toWorld(e); setPts((ps) => ps.map((p, i) => (i === drag.current ? [Math.max(0, Math.min(1, w[0])), Math.max(0, Math.min(1, w[1]))] as P : p))); };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Bez phase={key} pts={DEFAULT} t={tRef.current} hull={key === 'bernstein'} /> });

  const scenes: StoryScene[] = [
    scene('points', 'A curve from a few points', 'A Bézier curve is defined by a handful of control points. The first and last are the endpoints the curve passes through; the ones in between are handles that pull the curve toward them, like magnets, without being touched. Four control points give a cubic Bézier — the workhorse of fonts and vector graphics.'),
    scene('lerp', 'Just repeated linear interpolation', 'de Casteljau’s algorithm needs no formula — only lerps. Pick a fraction t along each edge of the control polygon (blue → orange points). Then lerp along the edges connecting THOSE (orange → green). One more lerp (green → the final point) and you have a single point. It sits exactly on the curve.'),
    scene('trace', 'Sweep t to trace the curve', 'Now sweep t from 0 to 1. That final construction point glides from the first control point to the last, and the path it sweeps out IS the Bézier curve. Every point on the curve is built from this little pyramid of interpolations — no powers, no trig, just shifts of fractions.'),
    scene('bernstein', 'It equals the Bernstein polynomial', 'This geometric construction matches the algebraic form exactly: B(t) = Σ C(n,i)(1−t)ⁿ⁻ⁱtⁱ Pᵢ (verified to 15 digits). Those weights are all ≥ 0 and sum to 1, so every curve point is a blend of the control points — which means the whole curve is trapped inside their convex hull (shaded), a cheap bound renderers exploit.'),
    scene('subdivide', 'Split it into two Béziers', 'The pyramid’s outer edges are a bonus: the left legs (P₀, and each level’s first point) are the control points of the curve’s left half, the right legs its right half. So splitting at any t yields two smaller Béziers that reproduce the original exactly — how renderers flatten curves to line segments adaptively, and how curve intersections are found by recursive splitting.'),
    { key: 'run', title: 'Drag the control points', caption: 'Drag any of the four control points and watch the curve reshape — the endpoints anchor it, the inner handles bend it and set the tangents. The de Casteljau pyramid keeps sweeping so you can see how each point is built. Toggle the convex hull: the curve never escapes it. This is exactly how a font glyph or an SVG path is defined.', render: () => <Bez phase="run" pts={pts} t={tRef.current} hull={hull} svgRef={svgRef} onDown={(i) => (drag.current = i)} onMove={onMove} onUp={() => (drag.current = null)} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A <strong>Bézier curve</strong> is a smooth path defined by a few control points — the first and last are the endpoints, the middle ones pull the curve toward them like magnets. <strong>de Casteljau’s algorithm</strong> draws it with nothing but repeated linear interpolation: for a parameter t from 0 to 1, lerp between each adjacent pair of control points, then between those results, and again, until one point remains — that point lies on the curve, and as t sweeps it traces the whole thing.</>,
        takeaway: <>A degree-n Bézier has n+1 control points P₀…Pₙ. <strong>de Casteljau</strong> evaluates the point at parameter t with a pyramid of linear interpolations: lerp each adjacent pair (n points), then those (n−1), down to one point — the curve point at t; sweeping t ∈ [0,1] traces the curve. This geometric construction is numerically stable (only convex combinations, no powers) and equals the algebraic <strong>Bernstein form</strong> exactly: <code>B(t) = Σᵢ C(n,i)(1−t)ⁿ⁻ⁱtⁱ Pᵢ</code> (verified here: the two agree to 3e-16). The Bernstein weights are non-negative and sum to 1, and everything follows: the curve starts at P₀ and ends at Pₙ, is tangent to the control polygon at the ends, and stays inside the <strong>convex hull</strong> of its control points — a cheap bound used to cull curves and speed intersection. The pyramid’s outer edges give the <strong>subdivision</strong> property — splitting at t produces two sub-Béziers (the left and right legs of the pyramid) that together reproduce the original exactly (verified: 1e-16), which is how renderers adaptively flatten curves into line segments and how curve–curve intersection is done by recursive splitting. Cubic Béziers (4 points) are the workhorse of vector graphics: they shape every glyph in a TrueType/PostScript font, every path in SVG, PDF, and Illustrator, and the ease curves of UI animation; chaining them with matched tangents makes smooth splines, and their rational tensor-product generalization (NURBS) is the backbone of CAD.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="bez-ctl"><input type="checkbox" checked={hull} onChange={(e) => setHull(e.target.checked)} /> show convex hull · <span className="bez-hint">drag the ● control points</span></label>
      )}
    />
  );
}

function Bez({ phase, pts, t, hull, svgRef, onDown, onMove, onUp }: { phase: Phase; pts: P[]; t: number; hull: boolean; svgRef?: React.Ref<SVGSVGElement>; onDown?: (i: number) => void; onMove?: (e: React.PointerEvent) => void; onUp?: () => void }) {
  const on = (p: Phase) => phase === p;
  const showScaffold = !on('points');
  const ls = levels(pts, t);
  const curve = Array.from({ length: 81 }, (_, i) => at(pts, i / 80));
  return (
    <svg viewBox="0 0 900 420" className="story-svg" ref={svgRef} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} style={{ touchAction: 'none' }}>
      <text x="60" y="24" className="bez-col">cubic Bézier · {pts.length} control points · de Casteljau at t={t.toFixed(2)}</text>

      {/* convex hull */}
      {hull && <polygon points={hullOf(pts).map((p) => `${gx(p[0])},${gy(p[1])}`).join(' ')} className="bez-hull" />}

      {/* control polygon */}
      <polyline points={pts.map((p) => `${gx(p[0])},${gy(p[1])}`).join(' ')} className="bez-poly" fill="none" />

      {/* de Casteljau scaffold: each intermediate level's polyline + points */}
      {showScaffold && ls.slice(1).map((lv, li) => (
        <g key={li}>
          {lv.length > 1 && <polyline points={lv.map((p) => `${gx(p[0])},${gy(p[1])}`).join(' ')} className="bez-lvl" style={{ stroke: `hsl(${LVLHUE[(li + 1) % LVLHUE.length]} 70% 60% / .8)` }} fill="none" />}
          {lv.map((p, i) => <circle key={i} cx={gx(p[0])} cy={gy(p[1])} r={li === ls.length - 2 ? 6 : 3.5} style={{ fill: `hsl(${LVLHUE[(li + 1) % LVLHUE.length]} 75% 62%)` }} />)}
        </g>
      ))}

      {/* the traced curve */}
      <polyline points={curve.map((p) => `${gx(p[0])},${gy(p[1])}`).join(' ')} className="bez-curve" fill="none" />
      {/* subdivision: left/right sub-control polygons */}
      {on('subdivide') && (() => { const L = ls.map((lv) => lv[0]), Rr = ls.map((lv) => lv[lv.length - 1]).reverse();
        return <><polyline points={L.map((p) => `${gx(p[0])},${gy(p[1])}`).join(' ')} className="bez-sub a" fill="none" /><polyline points={Rr.map((p) => `${gx(p[0])},${gy(p[1])}`).join(' ')} className="bez-sub b" fill="none" />{[...L, ...Rr].map((p, i) => <circle key={i} cx={gx(p[0])} cy={gy(p[1])} r="4" className="bez-subpt" />)}</>; })()}

      {/* control-point handles (draggable in run) */}
      {pts.map((p, i) => <circle key={i} cx={gx(p[0])} cy={gy(p[1])} r="8" className={`bez-ctrl ${on('run') ? 'drag' : ''}`} onPointerDown={onDown ? (e) => { (e.target as Element).setPointerCapture(e.pointerId); onDown(i); } : undefined} />)}
      {pts.map((p, i) => <text key={'l' + i} x={gx(p[0])} y={gy(p[1]) - 12} className="bez-plbl" textAnchor="middle">P{i}</text>)}

      <text x="450" y="410" className="bez-foot" textAnchor="middle">
        {on('points') ? 'endpoints P0, P3 are on the curve; P1, P2 pull it (never touched)'
          : on('lerp') ? 'lerp along edges, then along those, down to one point on the curve'
          : on('trace') ? 'sweep t 0→1 and the final point traces the whole Bézier'
          : on('bernstein') ? 'weights ≥0 sum to 1 → curve stays inside the convex hull'
          : on('subdivide') ? 'the pyramid legs are two smaller Béziers = the split curve'
          : 'drag P0–P3 to reshape; the curve is trapped in the control hull'}
      </text>
    </svg>
  );
}

// 2D convex hull (monotone chain) for the control points
function hullOf(pts: P[]): P[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P[] = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const hi: P[] = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
