// Guided story: orbital mechanics & why the integrator matters. Simulating a planet means stepping time forward and
// updating velocity/position from gravity — but the update ORDER decides stability. Forward-Euler systematically
// injects energy each step, so the orbit spirals out; velocity-Verlet is symplectic and conserves energy essentially
// forever, keeping the orbit closed. Verified in node: over a few orbits, Euler drifts ~75% in energy (r: 1→3.8),
// Verlet 0% (r stays 1). Why orbital/molecular/game physics use Verlet/leapfrog. Live animation. Sandboxed/CONCEPTUAL.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const GM = 1;
type P = { x: number; y: number; vx: number; vy: number };
const accel = (x: number, y: number) => { const r2 = x * x + y * y, r = Math.sqrt(r2); return [-GM * x / (r2 * r), -GM * y / (r2 * r)]; };
const energy = (p: P) => 0.5 * (p.vx * p.vx + p.vy * p.vy) - GM / Math.hypot(p.x, p.y);
function stepEuler(p: P, dt: number): P { const [ax, ay] = accel(p.x, p.y); return { x: p.x + p.vx * dt, y: p.y + p.vy * dt, vx: p.vx + ax * dt, vy: p.vy + ay * dt }; }
function stepVerlet(p: P, dt: number): P { const [ax, ay] = accel(p.x, p.y); const x = p.x + p.vx * dt + 0.5 * ax * dt * dt, y = p.y + p.vy * dt + 0.5 * ay * dt * dt; const [ax2, ay2] = accel(x, y); return { x, y, vx: p.vx + 0.5 * (ax + ax2) * dt, vy: p.vy + 0.5 * (ay + ay2) * dt }; }
const STAR = { x: 450, y: 214 }, SCALE = 84;
const scr = (x: number, y: number) => ({ x: STAR.x + x * SCALE, y: STAR.y + y * SCALE });
const START: P = { x: 1, y: 0, vx: 0, vy: 1 };

type Phase = 'sim' | 'euler' | 'inject' | 'verlet' | 'why' | 'run';

export function OrbitSection() {
  const [dt, setDt] = useState(0.05);
  const dtRef = useRef(dt); dtRef.current = dt;
  const E = useRef<P>({ ...START }); const V = useRef<P>({ ...START });
  const tE = useRef<{ x: number; y: number }[]>([]); const tV = useRef<{ x: number; y: number }[]>([]);
  const [, tick] = useState(0);
  const reset = () => { E.current = { ...START }; V.current = { ...START }; tE.current = []; tV.current = []; };
  useEffect(() => {
    let raf = 0; const loop = () => {
      for (let i = 0; i < 2; i++) { E.current = stepEuler(E.current, dtRef.current); V.current = stepVerlet(V.current, dtRef.current); }
      if (Math.hypot(E.current.x, E.current.y) < 6) tE.current.push(scr(E.current.x, E.current.y));
      tV.current.push(scr(V.current.x, V.current.y));
      if (tE.current.length > 600) tE.current.shift(); if (tV.current.length > 300) tV.current.shift();
      tick((t) => (t + 1) % 100000); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Orbit phase={key} e={E.current} v={V.current} te={tE.current} tv={tV.current} /> });

  const scenes: StoryScene[] = [
    scene('sim', 'Simulating an orbit', 'A planet orbits a star under gravity. To simulate it, step time forward in tiny increments dt: at each step compute the gravitational pull, update the velocity, update the position. Simple enough — but the order in which you do those two updates decides whether the orbit is stable or falls apart.'),
    scene('euler', 'Naive Euler spirals out', 'The obvious way (forward Euler): move by the current velocity, then update the velocity from the current force. Run it and the orbit doesn’t close — the red planet slowly spirals outward, lap after lap, drifting away from the star it should be circling.'),
    scene('inject', 'The method injects energy', 'That drift isn’t random jitter: Euler’s error systematically adds a little energy every single step. So the total energy climbs steadily — around 75% too high after just a few orbits — and the orbit inflates. In a real simulation the planet would fly off or crash.'),
    scene('verlet', 'Velocity-Verlet is symplectic', 'Now center the update (velocity-Verlet): advance the position with the current acceleration, then update the velocity using the average of the old and new accelerations. The green planet’s orbit stays closed — its energy oscillates by a hair but never drifts. Such “symplectic” integrators preserve the geometry of the physics.'),
    scene('why', 'Why it matters everywhere', 'This is why orbital, molecular-dynamics, and game-physics simulations use Verlet or leapfrog, not Euler — you can run them for millions of steps without energy leaking in or out, at the same cost per step. (The cloth-and-rope story leaned on plain Verlet for exactly this stability.)'),
    { key: 'run', title: 'Race the integrators', caption: 'Both planets start identically; only the integrator differs. Watch Euler (red) spiral away while Verlet (green) holds a closed orbit. Push dt up and Euler falls apart faster — bigger steps, bigger spurious energy — while Verlet degrades gracefully. Reset to restart them together.', render: () => <Orbit phase="run" e={E.current} v={V.current} te={tE.current} tv={tV.current} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To simulate a planet orbiting a star you step time forward in small increments: compute the gravitational pull, nudge the velocity, nudge the position. It seems like the details of that update shouldn’t matter much — but they decide whether the orbit stays stable for a billion years or spirals apart in a few laps. The naive method (forward Euler) quietly injects energy every step and the planet drifts away; the right method (velocity-Verlet) conserves energy essentially forever.</>,
        takeaway: <>The forward-Euler update — move by the current velocity, then update velocity from the current force — has a truncation error that isn’t random: for an orbit it systematically <strong>adds energy each step</strong>, so total energy climbs steadily and the orbit inflates (verified: ~75% energy drift and the radius nearly quadrupling in a few orbits, versus 0% for Verlet). <strong>Velocity-Verlet</strong> fixes it by centering the update — advance the position using the current acceleration, then update the velocity with the <em>average</em> of the old and new accelerations. That makes it <strong>symplectic</strong>: it exactly conserves a quantity extremely close to the true energy, so the energy oscillates within a tiny bound but never drifts, keeping the orbit closed for millions of steps at the same cost per step as Euler. Symplectic integrators (velocity-Verlet, leapfrog, and higher-order variants) are the standard in orbital mechanics, molecular dynamics, and game physics for exactly this reason — the cloth-and-rope story used plain Verlet for the same stability. The general lesson: for a long-running simulation, an integrator that preserves the problem’s structure beats a nominally “more accurate” one that leaks that structure away.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="orb-ctl">
          <button type="button" className="orb-btn" onClick={reset}>↻ reset</button>
          <label className="orb-lbl">step dt<input type="range" min={2} max={12} value={Math.round(dt * 100)} onChange={(e) => setDt(+e.target.value / 100)} /><b>{dt.toFixed(2)}</b></label>
          <span className="orb-live"><span className="orb-e">Euler r {Math.hypot(E.current.x, E.current.y).toFixed(2)}</span> · <span className="orb-v">Verlet r {Math.hypot(V.current.x, V.current.y).toFixed(2)}</span></span>
        </div>
      )}
    />
  );
}

function Orbit({ phase, e, v, te, tv }: { phase: Phase; e: P; v: P; te: { x: number; y: number }[]; tv: { x: number; y: number }[] }) {
  const on = (p: Phase) => phase === p;
  const showV = on('verlet') || on('why') || on('run');
  const showE = !on('verlet') || on('run') || on('why');
  const pe = scr(e.x, e.y), pv = scr(v.x, v.y);
  const path = (t: { x: number; y: number }[]) => t.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const E0 = energy(START);
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="28" className="orb-col">two planets, same start · only the time-stepping method differs</text>

      {/* trails */}
      {showE && <polyline points={path(te)} className="orb-trail e" fill="none" />}
      {showV && <polyline points={path(tv)} className="orb-trail v" fill="none" />}

      {/* star */}
      <circle cx={STAR.x} cy={STAR.y} r="10" className="orb-star" />
      <circle cx={STAR.x} cy={STAR.y} r="20" className="orb-glow" />

      {/* planets */}
      {showE && <><circle cx={pe.x} cy={pe.y} r="6" className="orb-p e" /><text x={pe.x + 10} y={pe.y + 4} className="orb-plbl e">Euler</text></>}
      {showV && <><circle cx={pv.x} cy={pv.y} r="6" className="orb-p v" /><text x={pv.x + 10} y={pv.y + 4} className="orb-plbl v">Verlet</text></>}

      {/* energy bars */}
      {(on('inject') || on('verlet') || on('why') || on('run')) && <>
        {showE && <text x="70" y="410" className="orb-en e">Euler energy: {((energy(e) - E0) / Math.abs(E0) * 100).toFixed(0)}% drift</text>}
        {showV && <text x="470" y="410" className="orb-en v">Verlet energy: {((energy(v) - E0) / Math.abs(E0) * 100).toFixed(1)}% drift</text>}
      </>}

      <text x="450" y="430" className="orb-foot" textAnchor="middle">
        {on('sim') ? 'step dt: get the force, update velocity, update position — but in what order?'
          : on('euler') ? 'forward Euler: the orbit spirals outward instead of closing'
          : on('inject') ? 'Euler adds energy every step → the orbit inflates and escapes'
          : on('verlet') ? 'velocity-Verlet: energy stays bounded → the orbit stays closed'
          : on('why') ? 'symplectic integrators run stably for millions of steps, same cost'
          : 'Euler drifts, Verlet holds — same physics, different integrator'}
      </text>
    </svg>
  );
}
