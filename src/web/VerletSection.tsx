// Guided story: Verlet integration — how games simulate cloth, rope, hair, and ragdolls. Store only positions (now +
// last frame); the difference IS the velocity, implicitly, so momentum is free. Advance a point by reflecting its last
// move plus gravity, then satisfy distance constraints by moving points toward their rest length (relaxation). No
// stored velocity, no springs — and because fixing a constraint also corrects the implicit velocity, no energy is
// injected, so it stays stable with stiff links. Real sim verified in node (settles hanging, constraints converge,
// finite/stable). Live rAF animation. Sandboxed/CONCEPTUAL.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const N = 16, L = 19, ANCHOR = { x: 450, y: 66 };
type Pt = { x: number; y: number; px: number; py: number; pin: boolean };
function makeRope(): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < N; i++) { const x = ANCHOR.x + i * L, y = ANCHOR.y; pts.push({ x, y, px: x, py: y, pin: i === 0 }); }
  return pts;
}
function step(pts: Pt[], iters: number, frame: number) {
  const G = 0.4, DAMP = 0.99, wind = Math.sin(frame * 0.015) * 0.12 + Math.sin(frame * 0.047) * 0.05;
  for (const p of pts) { if (p.pin) continue; const vx = (p.x - p.px) * DAMP, vy = (p.y - p.py) * DAMP; p.px = p.x; p.py = p.y; p.x += vx + wind; p.y += vy + G; }
  for (let k = 0; k < iters; k++) for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1e-9; const diff = ((d - L) / d) * 0.5; const ox = dx * diff, oy = dy * diff;
    if (!a.pin) { a.x += ox; a.y += oy; } if (!b.pin) { b.x -= ox; b.y -= oy; }
  }
}

type Phase = 'implicit' | 'sticks' | 'relax' | 'stable' | 'iters' | 'run';

export function VerletSection() {
  const ptsRef = useRef<Pt[]>(makeRope());
  const frameRef = useRef(0);
  const [iters, setIters] = useState(5);
  const itRef = useRef(iters); itRef.current = iters;
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf = 0; const loop = () => { frameRef.current++; step(ptsRef.current, itRef.current, frameRef.current); setTick((t) => (t + 1) % 1000000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  const nudge = () => { const p = ptsRef.current; const j = N - 1; p[j].px = p[j].x - 90; p[Math.floor(N / 2)].px += 40; };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Rope phase={key} pts={ptsRef.current} /> });

  const scenes: StoryScene[] = [
    scene('implicit', 'Position is velocity', 'Most physics stores a position and a velocity per point. Verlet stores only positions — where a point is now, and where it was last frame. The difference between them is the velocity, carried implicitly. To advance a point: new = current + (current − previous) + gravity. Momentum comes for free, with no velocity variable at all.'),
    scene('sticks', 'A rope is points and sticks', 'Model the rope as a chain of points joined by rigid sticks, each wanting a fixed rest length. After you move every point by its momentum and gravity, the sticks are now stretched or squashed — the links are the wrong length.'),
    scene('relax', 'Satisfy constraints by moving points', 'For each stick that’s too long or short, move its two endpoints toward the correct length — half each, or none if a point is pinned. Sweep over all the sticks a few times (relaxation). No forces, no springs to tune: just nudge positions until every link is about right again.'),
    scene('stable', 'Why it stays stable', 'Here’s the elegant part: because velocity lives in the position history, moving a point to fix a constraint automatically adjusts its velocity too. No energy is injected — so the rope can’t blow up the way stiff spring forces do. That stability is why position-based dynamics runs cloth, rope, hair, and ragdolls in games.'),
    scene('iters', 'More passes = stiffer', 'One relaxation pass leaves the rope stretchy; more passes make it rigid and inextensible. It’s a direct knob trading stiffness for compute. The whole method is a dozen lines and unconditionally stable — which is exactly why it won over springs for real-time cloth.'),
    { key: 'run', title: 'Nudge it', caption: 'Shove the rope and watch it swing and settle under gravity, links staying intact. Turn the relaxation passes down and it goes rubbery; turn them up and it stiffens toward a rigid chain. It’s already running — every frame is one integrate step plus a few constraint sweeps, the same loop behind game cloth and ragdolls.', render: () => <Rope phase="run" pts={ptsRef.current} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Most physics engines store a position <em>and</em> a velocity for every object. Verlet integration — behind cloth, rope, hair, and ragdolls in games — stores only positions: where each point is now and where it was last frame. The difference between the two <strong>is</strong> the velocity, implicitly, so momentum comes for free. To advance a point you reflect its last move and add gravity; to keep a rope rigid you move its points until the links are the right length again.</>,
        takeaway: <>Each step has two halves. <strong>Integrate</strong>: move every point by (current − previous), which carries its momentum, plus gravity — no stored velocity. Then <strong>satisfy constraints</strong>: model the rope as points joined by sticks of a fixed rest length, and for each stick now too long or short, move its two endpoints toward the correct length (half each, none if pinned). Do that relaxation pass a few times and all the lengths fall back into line. Because the velocity lives in the position history, nudging a point to fix a constraint also corrects its velocity — no energy is injected, so it stays stable even with stiff, inextensible links that would make a spring-and-force simulation explode. The number of passes is a direct stiffness-versus-cost knob: one is stretchy, several make it rigid. That simplicity and stability is why position-based dynamics runs the cloth, rope, hair, and ragdoll physics in most games.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="vlt-ctl">
          <button type="button" className="vlt-btn" onClick={nudge}>nudge the rope</button>
          <label className="vlt-lbl">relaxation passes<input type="range" min={1} max={20} value={iters} onChange={(e) => setIters(+e.target.value)} /><b>{iters}</b></label>
          <span className="vlt-hint">{iters <= 2 ? 'rubbery — links stretch' : iters >= 12 ? 'rigid — inextensible' : 'balanced'}</span>
        </div>
      )}
    />
  );
}

function Rope({ phase, pts }: { phase: Phase; pts: Pt[] }) {
  const on = (p: Phase) => phase === p;
  const last = pts[pts.length - 1];
  // velocity vector on the free end (current - previous)
  const vx = last.x - last.px, vy = last.y - last.py;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="34" className="vlt-col">Verlet rope — {pts.length} points, {pts.length - 1} distance constraints, live</text>

      {/* sticks */}
      {pts.slice(1).map((p, i) => <line key={i} x1={pts[i].x} y1={pts[i].y} x2={p.x} y2={p.y} className="vlt-stick" />)}
      {/* points */}
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.pin ? 7 : 4} className={`vlt-pt ${p.pin ? 'pin' : ''}`} />)}
      {/* anchor label */}
      <text x={pts[0].x} y={pts[0].y - 14} className="vlt-anchor" textAnchor="middle">pinned</text>

      {/* velocity arrow on the free end (implicit-velocity scene) */}
      {on('implicit') && (
        <g>
          <circle cx={last.px} cy={last.py} r="4" className="vlt-prev" />
          <line x1={last.px} y1={last.py} x2={last.x} y2={last.y} className="vlt-vel" />
          <text x={last.x + 12} y={last.y} className="vlt-vlbl">velocity = now − last ({vx.toFixed(0)},{vy.toFixed(0)})</text>
        </g>
      )}
      {on('sticks') && <text x={(pts[3].x + pts[4].x) / 2 + 8} y={(pts[3].y + pts[4].y) / 2} className="vlt-vlbl">stick: rest length {L}</text>}

      <text x="450" y="452" className="vlt-foot" textAnchor="middle">
        {on('implicit') ? 'no velocity stored — it lives in the gap between this frame and last'
          : on('sticks') ? 'each link wants a fixed length; integration knocks them off it'
          : on('relax') ? 'move each stick’s ends back to rest length, a few sweeps — relaxation'
          : on('stable') ? 'fixing position fixes velocity too → no energy injected → stable'
          : on('iters') ? 'more relaxation passes → stiffer rope; a dozen lines, always stable'
          : 'integrate + a few constraint sweeps per frame — game cloth in miniature'}
      </text>
    </svg>
  );
}
