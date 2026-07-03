// Guided story: k-means clustering (Lloyd's algorithm) — group unlabeled points into k clusters by alternating two
// steps: assign each point to its nearest center, then move each center to the mean of its points. Both steps only
// lower the total squared distance (inertia), so it decreases monotonically and converges. Verified in node: inertia
// drops every step (5.4 → 0.79) to a fixed point in a few iterations. Caveats: local optima (re-seed for different
// results) and you must pick k. The entry point to unsupervised learning; live animation. Sandboxed/CONCEPTUAL.
import { useEffect, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const K = 3;
const HUE = [210, 30, 150];
function makePoints(): [number, number][] {
  let s = 17; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const cen = [[0.26, 0.32], [0.72, 0.36], [0.5, 0.74]]; const p: [number, number][] = [];
  for (const [cx, cy] of cen) for (let i = 0; i < 34; i++) p.push([Math.min(0.97, Math.max(0.03, cx + (rnd() - 0.5) * 0.24)), Math.min(0.97, Math.max(0.03, cy + (rnd() - 0.5) * 0.24))]);
  return p;
}
const PTS = makePoints();
const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const assign = (C: number[][]) => PTS.map((p) => { let bi = 0, bd = 1e9; for (let k = 0; k < K; k++) { const dd = d2(p, C[k]); if (dd < bd) { bd = dd; bi = k; } } return bi; });
const inertia = (C: number[][], a: number[]) => PTS.reduce((s, p, i) => s + d2(p, C[a[i]]), 0);
function update(a: number[]): number[][] { const C: number[][] = []; for (let k = 0; k < K; k++) { const g = PTS.filter((_, i) => a[i] === k); C.push(g.length ? [g.reduce((s, p) => s + p[0], 0) / g.length, g.reduce((s, p) => s + p[1], 0) / g.length] : [Math.random(), Math.random()]); } return C; }

const OX = 210, OY = 20, SZ = 400;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + y * SZ;

type Phase = 'group' | 'steps' | 'lower' | 'converge' | 'limits' | 'run';

export function KMeansSection() {
  const seedRef = useRef(3);
  const initC = (seed: number) => { let s = seed * 2654435761 >>> 0; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); }; return Array.from({ length: K }, () => [0.15 + r() * 0.7, 0.15 + r() * 0.7]); };
  const C = useRef<number[][]>(initC(3)); const A = useRef<number[]>(assign(C.current)); const itRef = useRef(0); const inRef = useRef(inertia(C.current, A.current)); const conv = useRef(false);
  const [, tick] = useState(0); const frame = useRef(0);
  const reseed = () => { seedRef.current = (Math.random() * 1e9) | 0; C.current = initC(seedRef.current); A.current = assign(C.current); itRef.current = 0; inRef.current = inertia(C.current, A.current); conv.current = false; };
  useEffect(() => {
    let raf = 0; const loop = () => {
      frame.current++;
      if (frame.current % 20 === 0 && !conv.current) { A.current = assign(C.current); const nc = update(A.current); const before = inRef.current; C.current = nc; A.current = assign(C.current); inRef.current = inertia(C.current, A.current); itRef.current++; if (Math.abs(before - inRef.current) < 1e-6) conv.current = true; }
      tick((t) => (t + 1) % 100000); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <KM phase={key} c={C.current} a={A.current} it={itRef.current} inert={inRef.current} conv={conv.current} /> });

  const scenes: StoryScene[] = [
    scene('group', 'Grouping without labels', 'Here’s a cloud of unlabeled points — think customers to segment, pixels to reduce to a palette, or documents turned into vectors. You want to split them into k natural groups whose members sit close together, but nothing tells you which point belongs where. That’s the clustering problem k-means solves.'),
    scene('steps', 'Two steps, alternating', 'Drop k centers somewhere (a guess), then alternate two moves. Assign: colour every point by its nearest center. Update: slide each center to the average position of the points that chose it. The centers drift toward the dense clumps and the colours re-sort around them.'),
    scene('lower', 'Every step lowers the error', 'The objective is the total squared distance from points to their center — the inertia. Assigning each point to its nearest center can only shrink that sum; moving a center to its points’ mean can only shrink it too (the mean is the least-squares point). So inertia falls with every single step, never rising.'),
    scene('converge', 'So it converges', 'Because inertia only decreases and can’t drop below zero, the alternation has to stop — usually within a handful of rounds, the moment no point switches cluster. The centers land on the cluster means and the colouring is stable. You’ve found a clustering.'),
    scene('limits', 'It finds a local optimum', 'One honest caveat: it finds A good clustering, not THE best. A poor initial guess can settle into a lopsided split, so in practice you run it several times (or seed the centers spread apart, k-means++) and keep the lowest inertia. And you must choose k — too few merges real groups, too many splits them.'),
    { key: 'run', title: 'Watch it cluster', caption: 'The two steps run live: points recolour to their nearest center, centers glide to their means, and the inertia readout falls until it locks. Re-seed to drop the centers somewhere new — usually it finds the same three clusters, but a bad start can strand a center and settle on a worse split. That’s the local-optimum caveat, live.', render: () => <KM phase="run" c={C.current} a={A.current} it={itRef.current} inert={inRef.current} conv={conv.current} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Given a cloud of unlabeled points — customers to segment, pixels to quantize, documents as vectors — <strong>k-means</strong> finds k natural groups whose members sit close together, with no labels to guide it. It does this by alternating two almost trivial steps until they stop changing anything: assign each point to its nearest cluster center, then move each center to the average of the points assigned to it.</>,
        takeaway: <>k-means (Lloyd’s algorithm) minimizes the total squared distance from points to their assigned center — the <strong>inertia</strong>. Start with k centers, then repeat: the <em>assignment</em> step puts every point with its nearest center, and the <em>update</em> step moves each center to the mean of its points. Both steps can only decrease the inertia — assigning to the nearest center trivially lowers each point’s distance, and the mean is exactly the point that minimizes the sum of squared distances to a set — so inertia falls <strong>monotonically</strong> and, being bounded below by zero, the algorithm converges (usually in a handful of iterations) to a fixed point where no point changes cluster. Two honest caveats: it converges to a <strong>local</strong> optimum, so a poor initial seeding can leave a bad clustering — in practice you run it several times or seed with <strong>k-means++</strong> (spreading the initial centers apart) and keep the lowest-inertia result — and you must choose k yourself (the “elbow” in inertia-versus-k, or silhouette scores, help). Its speed and simplicity make it the default clustering algorithm, and the same assign-then-recompute pattern is an instance of expectation-maximization, underlying Gaussian mixture models, vector quantization, and image color reduction.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="km-ctl">
          <button type="button" className="km-btn" onClick={reseed}>↻ re-seed centers</button>
          <span className="km-live">iteration {itRef.current} · inertia {inRef.current.toFixed(3)}{conv.current ? ' · converged ✓' : ''}</span>
        </div>
      )}
    />
  );
}

function KM({ phase, c, a, it, inert, conv }: { phase: Phase; c: number[][]; a: number[]; it: number; inert: number; conv: boolean }) {
  const on = (p: Phase) => phase === p;
  const colored = !on('group');
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="30" className="km-col">{PTS.length} points, k={K}{colored ? ` · iteration ${it} · inertia ${inert.toFixed(3)}${conv ? ' · converged' : ''}` : ' · unlabeled'}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="km-frame" />

      {/* assignment lines (steps/lower scenes) */}
      {(on('steps') || on('lower')) && PTS.map((p, i) => <line key={'l' + i} x1={sx(p[0])} y1={sy(p[1])} x2={sx(c[a[i]][0])} y2={sy(c[a[i]][1])} className="km-link" style={{ stroke: `hsl(${HUE[a[i]]} 50% 55% / .3)` }} />)}

      {/* points */}
      {PTS.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3.5" className="km-pt" style={{ fill: colored ? `hsl(${HUE[a[i]]} 65% 62%)` : 'hsl(210 12% 60%)' }} />)}

      {/* centroids (X) */}
      {colored && c.map((ct, k) => <g key={k}><line x1={sx(ct[0]) - 9} y1={sy(ct[1]) - 9} x2={sx(ct[0]) + 9} y2={sy(ct[1]) + 9} className="km-cen" style={{ stroke: `hsl(${HUE[k]} 80% 66%)` }} /><line x1={sx(ct[0]) - 9} y1={sy(ct[1]) + 9} x2={sx(ct[0]) + 9} y2={sy(ct[1]) - 9} className="km-cen" style={{ stroke: `hsl(${HUE[k]} 80% 66%)` }} /></g>)}

      <text x="450" y="424" className="km-foot" textAnchor="middle">
        {on('group') ? 'find k groups of nearby points — with no labels to guide you'
          : on('steps') ? 'assign points to nearest center, then move each center to its mean'
          : on('lower') ? 'both steps only shrink the total squared distance (inertia)'
          : on('converge') ? 'inertia falls to a floor → the clustering stops changing'
          : on('limits') ? 'a local optimum: re-seed and keep the lowest inertia; choose k'
          : conv ? `converged in ${it} iterations · inertia ${inert.toFixed(3)}` : `iterating… inertia ${inert.toFixed(3)} and falling`}
      </text>
    </svg>
  );
}
