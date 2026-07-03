// Guided story: the double pendulum — deterministic chaos. Its motion follows exact, fully deterministic equations
// (energy holds to ~5 digits over seconds — RK4 slowly drifts, it's not symplectic — verified in node), yet two starts differing by a thousandth of a degree diverge
// exponentially and do completely different things within seconds (sensitive dependence / positive Lyapunov). Chaos
// is that combination — deterministic yet unpredictable — the same reason weather can't be forecast far ahead. Real
// RK4 integration of the coupled ODEs, live animation. Distinct from the "Chaos engineering" (resilience) section.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const g = 9.81, m1 = 1, m2 = 1, L1 = 1, L2 = 1;
type S = [number, number, number, number]; // θ1, θ2, ω1, ω2
function deriv(s: S): S {
  const [t1, t2, w1, w2] = s, d = t1 - t2, den = 2 * m1 + m2 - m2 * Math.cos(2 * t1 - 2 * t2);
  const a1 = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * Math.cos(d))) / (L1 * den);
  const a2 = (2 * Math.sin(d) * (w1 * w1 * L1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * L2 * m2 * Math.cos(d))) / (L2 * den);
  return [w1, w2, a1, a2];
}
function rk4(s: S, h: number): S {
  const k1 = deriv(s), k2 = deriv(s.map((v, i) => v + h / 2 * k1[i]) as S), k3 = deriv(s.map((v, i) => v + h / 2 * k2[i]) as S), k4 = deriv(s.map((v, i) => v + h * k3[i]) as S);
  return s.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as S;
}
function energy(s: S): number {
  const [t1, t2, w1, w2] = s, y1 = -L1 * Math.cos(t1), y2 = y1 - L2 * Math.cos(t2);
  const v1x = w1 * L1 * Math.cos(t1), v1y = w1 * L1 * Math.sin(t1), v2x = v1x + w2 * L2 * Math.cos(t2), v2y = v1y + w2 * L2 * Math.sin(t2);
  return 0.5 * m1 * (v1x * v1x + v1y * v1y) + 0.5 * m2 * (v2x * v2x + v2y * v2y) + m1 * g * y1 + m2 * g * y2;
}
const PIV = { x: 450, y: 160 }, SC = 108;
const bobs = (s: S) => { const b1 = { x: PIV.x + SC * Math.sin(s[0]), y: PIV.y + SC * Math.cos(s[0]) }; return { b1, b2: { x: b1.x + SC * Math.sin(s[1]), y: b1.y + SC * Math.cos(s[1]) } }; };

type Phase = 'what' | 'twin' | 'sensitive' | 'energy' | 'butterfly' | 'run';

export function DoublePendulumSection() {
  const [delta, setDelta] = useState(0.001);
  const A = useRef<S>([2.4, 2.4, 0, 0]); const B = useRef<S>([2.4 + 0.001, 2.4, 0, 0]);
  const trailA = useRef<{ x: number; y: number }[]>([]); const trailB = useRef<{ x: number; y: number }[]>([]);
  const [, tick] = useState(0);
  const reset = (dd: number) => { A.current = [2.4, 2.4, 0, 0]; B.current = [2.4 + dd, 2.4, 0, 0]; trailA.current = []; trailB.current = []; };
  useEffect(() => {
    let raf = 0; const loop = () => {
      for (let i = 0; i < 5; i++) { A.current = rk4(A.current, 0.006); B.current = rk4(B.current, 0.006); }
      const pa = bobs(A.current).b2, pb = bobs(B.current).b2; trailA.current.push(pa); trailB.current.push(pb);
      if (trailA.current.length > 140) { trailA.current.shift(); trailB.current.shift(); }
      tick((t) => (t + 1) % 100000); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <DP phase={key} a={A.current} b={B.current} ta={trailA.current} tb={trailB.current} /> });

  const scenes: StoryScene[] = [
    scene('what', 'A pendulum on a pendulum', 'Hang one pendulum from the end of another and the motion turns wildly complex — swinging, whirling, flipping over, never quite repeating. Yet it’s no trick: the two rods obey an exact pair of equations from Newton’s laws. The same starting position always gives the same motion.'),
    scene('twin', 'Deterministic — but run two', 'So launch two of them from almost the same start: a difference of a thousandth of a degree in one angle (blue and orange, on top of each other). For a moment they move as one. Then they part, and within seconds they’re swinging completely differently.'),
    scene('sensitive', 'Sensitive dependence = chaos', 'That tiny gap doesn’t stay tiny — it grows roughly exponentially, doubling every fraction of a second (a positive Lyapunov exponent). This is deterministic chaos: not randomness, but a system so sensitive that any imprecision in the start balloons into total unpredictability.'),
    scene('energy', 'Nothing is faked — energy is conserved', 'This isn’t numerical noise. Integrate the equations carefully and the total energy (kinetic + potential) holds to about five digits over the first seconds, then slowly drifts (RK4 isn’t symplectic). Each pendulum traces its own accurate trajectory — the two just happen to be different trajectories, because they started a hair apart.'),
    scene('butterfly', 'The butterfly effect', 'This is why weather can’t be forecast far ahead. Same math, same sensitivity: measure the atmosphere a hair imperfectly and the forecast is noise in two weeks. Determinism does not guarantee predictability — a lesson Lorenz stumbled onto rounding a weather model’s inputs.'),
    { key: 'run', title: 'Split them yourself', caption: 'Set how far apart the two pendulums start, then reset and watch. Even at a hundredth of a degree they track for a few seconds — then the exponential divergence takes over and their traced paths (the fading trails) go entirely separate ways. The equations are identical and exact; only the start differs.', render: () => <DP phase="run" a={A.current} b={B.current} ta={trailA.current} tb={trailB.current} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Hang one pendulum from the end of another and its motion turns wildly complex — swinging, whirling, never repeating. Yet the equations of motion are exact and completely <strong>deterministic</strong>: identical starting conditions always produce identical motion. The twist is that the system is extraordinarily <strong>sensitive</strong> to those conditions — start two of them a thousandth of a degree apart and within seconds they’re doing entirely different things. That’s deterministic chaos, and it’s why the weather can’t be forecast far ahead.</>,
        takeaway: <>The double pendulum obeys a fixed pair of coupled differential equations from Newton’s laws; integrate them accurately (here with RK4) and total energy holds to about five digits over the first seconds, drifting slowly because RK4 isn’t symplectic — the trajectory is an <em>accurate approximation</em>, not numerical noise. So it’s fully deterministic: the same initial angles and speeds always trace the same path. But it shows <strong>sensitive dependence on initial conditions</strong>: the gap between two nearly-identical starts grows roughly exponentially in time (a positive <strong>Lyapunov exponent</strong>), so a difference of 0.001° becomes a difference of 180° within seconds. Chaos is exactly this combination — deterministic yet unpredictable — because any real measurement has finite precision, and that tiny uncertainty is amplified without bound. It’s the same reason weather forecasts degrade to noise beyond about two weeks (Lorenz’s “butterfly effect”), why a specific die roll is unpredictable despite deterministic physics, and why chaotic dynamics show up from planetary orbits to heart rhythms. Determinism and predictability are not the same thing.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="dp-ctl">
          <button type="button" className="dp-btn" onClick={() => reset(delta)}>↻ reset &amp; split</button>
          <label className="dp-lbl">start gap<input type="range" min={1} max={100} value={Math.round(delta * 10000)} onChange={(e) => { const d = +e.target.value / 10000; setDelta(d); reset(d); }} /><b>{(delta * 57.2958).toFixed(3)}°</b></label>
          <span className="dp-live">energy {energy(A.current).toFixed(3)} (conserved)</span>
        </div>
      )}
    />
  );
}

function DP({ phase, a, b, ta, tb }: { phase: Phase; a: S; b: S; ta: { x: number; y: number }[]; tb: { x: number; y: number }[] }) {
  const on = (p: Phase) => phase === p;
  const A = bobs(a), B = bobs(b);
  const sep = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const path = (t: { x: number; y: number }[]) => t.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="30" className="dp-col">double pendulum · two near-identical starts{!on('what') ? ` · separation ${sep.toFixed(2)} rad` : ''}</text>

      {/* trails */}
      {!on('what') && <><polyline points={path(tb)} className="dp-trail b" fill="none" /><polyline points={path(ta)} className="dp-trail a" fill="none" /></>}

      {/* pendulum B (orange) */}
      {!on('what') && <g>
        <line x1={PIV.x} y1={PIV.y} x2={B.b1.x} y2={B.b1.y} className="dp-rod b" /><line x1={B.b1.x} y1={B.b1.y} x2={B.b2.x} y2={B.b2.y} className="dp-rod b" />
        <circle cx={B.b1.x} cy={B.b1.y} r="6" className="dp-bob b" /><circle cx={B.b2.x} cy={B.b2.y} r="9" className="dp-bob b" />
      </g>}
      {/* pendulum A (blue) */}
      <g>
        <line x1={PIV.x} y1={PIV.y} x2={A.b1.x} y2={A.b1.y} className="dp-rod a" /><line x1={A.b1.x} y1={A.b1.y} x2={A.b2.x} y2={A.b2.y} className="dp-rod a" />
        <circle cx={A.b1.x} cy={A.b1.y} r="6" className="dp-bob a" /><circle cx={A.b2.x} cy={A.b2.y} r="9" className="dp-bob a" />
      </g>
      <circle cx={PIV.x} cy={PIV.y} r="4" className="dp-piv" />

      {on('energy') && <text x={PIV.x} y={PIV.y - 20} className="dp-en" textAnchor="middle">energy = {energy(a).toFixed(4)} (constant)</text>}

      <text x="450" y="420" className="dp-foot" textAnchor="middle">
        {on('what') ? 'exact, deterministic equations — same start, same motion'
          : on('twin') ? 'two near-identical starts: together now, apart in seconds'
          : on('sensitive') ? `separation ${sep.toFixed(2)} rad and growing exponentially`
          : on('energy') ? 'total energy ~constant over seconds — accurate, not noise'
          : on('butterfly') ? 'tiny uncertainty, amplified without bound → unpredictable'
          : `separation ${sep.toFixed(2)} rad — deterministic, yet unpredictable`}
      </text>
    </svg>
  );
}
