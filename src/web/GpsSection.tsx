// Guided story: how GPS finds your position — trilateration + the clock-bias trick. Each satellite broadcasts its
// position and the exact send time (atomic clock); the receiver turns travel-time into a distance, placing it on a
// sphere. Intersect enough spheres → your location. But the receiver's cheap clock is off, inflating every range by
// the same amount, so the spheres miss — solved by treating the clock offset as a 4th unknown (why you need 4 sats).
// Real geometry + a real Gauss-Newton solver (verified in node: recovers position + bias exactly). 2D toy, sandboxed.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const SATS: [number, number][] = [[12, 90], [88, 86], [18, 16], [84, 22]];
const TRUE: [number, number] = [52, 48];
const TB = 7; // true receiver clock bias, in distance units
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const PR = SATS.map((s) => dist(s, TRUE) + TB); // pseudoranges the receiver measures

// solve 3x3 linear system by Gaussian elimination
function solve3(M: number[][]): number[] {
  const A = M.map((r) => [...r]);
  for (let c = 0; c < 3; c++) {
    let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 3; r++) { if (r === c || Math.abs(A[c][c]) < 1e-12) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k]; }
  }
  return [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
}
// best-fit receiver point for FIXED circle radii (bias baked in) — Gauss-Newton on (x,y). Returns point + rms residual.
function fit2D(radii: number[]): { p: [number, number]; rms: number } {
  let x = 50, y = 50;
  for (let it = 0; it < 30; it++) {
    let a00 = 0, a01 = 0, a11 = 0, b0 = 0, b1 = 0;
    for (let i = 0; i < SATS.length; i++) { const d = dist(SATS[i], [x, y]) || 1e-9; const gx = (x - SATS[i][0]) / d, gy = (y - SATS[i][1]) / d, r = d - radii[i]; a00 += gx * gx; a01 += gx * gy; a11 += gy * gy; b0 += gx * r; b1 += gy * r; }
    const det = a00 * a11 - a01 * a01 || 1e-9; const dx = -(a11 * b0 - a01 * b1) / det, dy = -(a00 * b1 - a01 * b0) / det;
    x += dx; y += dy; if (Math.abs(dx) + Math.abs(dy) < 1e-6) break;
  }
  let ss = 0; for (let i = 0; i < SATS.length; i++) { const e = dist(SATS[i], [x, y]) - radii[i]; ss += e * e; }
  return { p: [x, y], rms: Math.sqrt(ss / SATS.length) };
}
// full solve for (x, y, bias) from the pseudoranges — the 4-unknowns-in-3D idea, here 3 unknowns in 2D
function solveXYB(): number {
  let x = 50, y = 50, tb = 0;
  for (let it = 0; it < 40; it++) {
    const JtJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; const Jtr = [0, 0, 0];
    for (let i = 0; i < SATS.length; i++) { const d = dist(SATS[i], [x, y]) || 1e-9; const J = [(x - SATS[i][0]) / d, (y - SATS[i][1]) / d, 1]; const r = d + tb - PR[i]; for (let a = 0; a < 3; a++) { Jtr[a] += J[a] * r; for (let b = 0; b < 3; b++) JtJ[a][b] += J[a] * J[b]; } }
    const d = solve3(JtJ.map((row, i) => [...row, -Jtr[i]])); x += d[0]; y += d[1]; tb += d[2];
  }
  return tb;
}

type Phase = 'tof' | 'trilat' | 'clock' | 'fourth' | 'solve' | 'run';

export function GpsSection() {
  const [bias, setBias] = useState(0);
  const fit = useMemo(() => fit2D(PR.map((p) => p - bias)), [bias]);
  const locked = fit.rms < 0.6;

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, b: number): StoryScene =>
    ({ key, title, caption, render: () => <Gps phase={key} bias={b} /> });

  const scenes: StoryScene[] = [
    scene('tof', 'Time of flight is distance', 'Every GPS satellite carries an atomic clock and constantly broadcasts its position and the exact time it sent each signal. Your receiver measures how long the signal took to arrive and multiplies by the speed of light. That one number is your distance to the satellite — which places you somewhere on a circle around it.', TB),
    scene('trilat', 'Three circles pin you down', 'One circle is a whole locus of possible positions. Two circles cross at two points. Three circles meet at a single point — and that point is you. This is trilateration: intersecting distance-spheres from satellites at known positions.', TB),
    scene('clock', 'But your clock is cheap', 'Here is the problem the satellites are spared. They keep atomic time; your phone does not. If your receiver’s clock is off by even a microsecond, every measured distance is wrong by about 300 metres — and wrong by the SAME amount, so the circles no longer meet at one point. Your fix is nowhere.', 0),
    scene('fourth', 'The clock error is a 4th unknown', 'Because the clock offset inflates every range equally, it is solvable: treat the clock error as one more unknown alongside your x, y (and z). Now you have four unknowns, so you need four satellites — four equations. Solving them gives your position AND corrects your clock to atomic accuracy, for free.', 3),
    scene('solve', 'Adjust the clock until they meet', 'Dial the assumed clock offset and the circles grow or shrink together. At exactly the right offset they converge on a single point — your true location. A real receiver does this least-squares solve every second, recovering position and time at once.', TB),
    { key: 'run', title: 'Find the fix', caption: 'Slide the assumed clock offset: at the wrong value the circles miss and the fix is fuzzy (high residual); at the true offset they lock onto one point. Or hit “solve the clock too” to run the real Gauss-Newton that treats the offset as a 4th unknown and snaps straight to the fix.', render: () => <Gps phase="run" bias={bias} fit={fit} locked={locked} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Each GPS satellite carries an atomic clock and constantly broadcasts its position and the exact time. Your receiver measures how long each signal took to arrive and multiplies by the speed of light to get its distance to that satellite — which places you on a sphere around it. Intersect enough spheres and they meet at one point: your location. The twist is that your phone’s clock is far too cheap to time light-speed signals accurately, and that error quietly corrupts every distance.</>,
        takeaway: <>A one-microsecond clock error is a ~300-metre distance error — and because your receiver’s clock offset inflates <em>every</em> measured range by the same amount, the spheres don’t quite intersect. The elegant fix: treat the clock offset as a <strong>fourth unknown</strong> alongside x, y, and z, so with four satellites you have four equations and can solve for position and the exact time together. That is why you need four satellites, not three, and why GPS hands you atomic-clock-accurate time for free. The receiver runs this least-squares solve every second; when the satellites are clustered close together in the sky the intersection is fuzzy — that “dilution of precision” is what makes your blue dot wobble in a city canyon.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="gps-ctl">assumed clock offset<input type="range" min={0} max={14} step={0.2} value={bias} onChange={(e) => setBias(+e.target.value)} /><b>{bias.toFixed(1)}</b></label>
          <button type="button" className="gps-btn" onClick={() => setBias(solveXYB())}>solve the clock too ▸</button>
          <span className={`gps-live ${locked ? 'ok' : 'bad'}`}>{locked ? '● fix locked — position + time recovered' : `circles miss — residual ${fit.rms.toFixed(1)}`}</span>
        </>
      )}
    />
  );
}

// map world coords (0..100) to the svg with a uniform scale so circles stay circles
const S = 3.7, OX = 250, OY = 430;
const px = (v: number) => OX + v * S, py = (v: number) => OY - v * S;
function Gps({ phase, bias, fit, locked }: { phase: Phase; bias: number; fit?: { p: [number, number]; rms: number }; locked?: boolean }) {
  const on = (p: Phase) => phase === p;
  const nCircles = on('tof') ? 1 : on('trilat') ? 3 : SATS.length;
  const f = fit ?? fit2D(PR.map((p) => p - bias));
  const isLocked = locked ?? f.rms < 0.6;
  const showFit = on('solve') || on('run') || on('fourth');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="42" className="gps-col">satellites (known positions) + distance circles</text>
      {SATS.slice(0, nCircles).map((s, i) => {
        const r = Math.max(0, (PR[i] - bias)) * S;
        return (
          <g key={i}>
            <circle cx={px(s[0])} cy={py(s[1])} r={r} className="gps-ring" />
            <rect x={px(s[0]) - 12} y={py(s[1]) - 12} width="24" height="24" rx="4" className="gps-sat" />
            <text x={px(s[0])} y={py(s[1]) + 5} className="gps-satlbl" textAnchor="middle">🛰</text>
          </g>
        );
      })}

      {/* the receiver fix */}
      {showFit && (
        <g>
          <circle cx={px(f.p[0])} cy={py(f.p[1])} r={isLocked ? 8 : 6 + f.rms * S} className={`gps-fix ${isLocked ? 'locked' : 'fuzzy'}`} />
          <text x={px(f.p[0])} y={py(f.p[1]) - 16} className={`gps-fixlbl ${isLocked ? 'locked' : ''}`} textAnchor="middle">{isLocked ? '📍 you' : 'fuzzy fix'}</text>
        </g>
      )}
      {(on('trilat')) && <><circle cx={px(TRUE[0])} cy={py(TRUE[1])} r="7" className="gps-fix locked" /><text x={px(TRUE[0])} y={py(TRUE[1]) - 16} className="gps-fixlbl locked" textAnchor="middle">📍 you</text></>}

      <text x="450" y="452" className="gps-foot" textAnchor="middle">
        {on('tof') ? 'one distance → you are somewhere on this circle'
          : on('trilat') ? 'three circles intersect at exactly one point — trilateration'
          : on('clock') ? 'a wrong clock inflates every range equally → the circles no longer meet'
          : on('fourth') ? '4 unknowns (x, y, z, clock) → 4 satellites; solving fixes your clock too'
          : on('solve') ? 'at the true clock offset the circles converge on your position'
          : isLocked ? 'fix locked: position and exact time recovered together' : `assumed offset ${bias.toFixed(1)} is wrong → circles miss by residual ${f.rms.toFixed(1)}`}
      </text>
    </svg>
  );
}
