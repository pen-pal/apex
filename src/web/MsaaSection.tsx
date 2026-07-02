// Guided story: MSAA (multisample antialiasing) — smooth jagged triangle edges cheaply by decoupling coverage from
// shading. Each pixel is fully in/out of a triangle, so slanted edges staircase (aliasing). Supersampling renders at
// N× and averages, but shades N× too. MSAA takes N coverage samples per pixel (is each inside?) but shades ONCE, then
// blends the pixel by its coverage fraction — smooth edges at ~1× shading, since only edge pixels aren't fully in/out.
// Verified in node: 4-sample coverage matches analytic area coverage to ~1 quantization step. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const GW = 18, GH = 10, PS = 36, OX = 78, OY = 54;
const S4: [number, number][] = [[0.375, 0.125], [0.875, 0.375], [0.125, 0.625], [0.625, 0.875]];
// triangle in grid coords, rotated by `rot` (radians) about its centroid
function tri(rot: number): [number, number][] {
  const base: [number, number][] = [[3, 1.4], [15, 3.2], [6, 9]];
  const cx = base.reduce((s, v) => s + v[0], 0) / 3, cy = base.reduce((s, v) => s + v[1], 0) / 3;
  const c = Math.cos(rot), s = Math.sin(rot);
  return base.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}
const cross = (a: number[], b: number[], p: number[]) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function inside(T: [number, number][], x: number, y: number) {
  const d1 = cross(T[0], T[1], [x, y]), d2 = cross(T[1], T[2], [x, y]), d3 = cross(T[2], T[0], [x, y]);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0; return !(neg && pos);
}
const coverage = (T: [number, number][], px: number, py: number) => S4.reduce((c, [dx, dy]) => c + (inside(T, px + dx, py + dy) ? 1 : 0), 0) / 4;
// blend background↔triangle by coverage
const BG = [26, 31, 46], TRI = [58, 159, 176];
const mix = (t: number) => `rgb(${BG.map((b, i) => Math.round(b + (TRI[i] - b) * t)).join(',')})`;

type Phase = 'jagged' | 'super' | 'msaa' | 'blend' | 'edges' | 'run';

export function MsaaSection() {
  const [rot, setRot] = useState(0);
  const [aa, setAa] = useState(true);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Grid phase={key} rot={0.12} aa={key !== 'jagged'} /> });

  const scenes: StoryScene[] = [
    scene('jagged', 'Jagged edges', 'Draw a triangle on a pixel grid and every pixel is either fully inside it or fully outside — there’s no in-between. So a slanted edge becomes a staircase of hard steps. That’s aliasing: a sharp edge that doesn’t line up with the grid, showing up as jaggies.'),
    scene('super', 'Supersampling: brute force', 'The obvious fix is to render everything at several times the resolution and average each block back down — the edge smooths out. But you’ve now shaded four (or sixteen) times as many pixels, and shading — textures, lighting, the pixel program — is the expensive part. It works, but it’s costly.'),
    scene('msaa', 'MSAA: sample coverage, shade once', 'The insight: you only need extra samples at the edges, not extra shading. MSAA takes several coverage samples per pixel — here 4, at fixed sub-pixel spots — and for each just asks “is this point inside the triangle?”. Coverage is how many landed inside, over 4. But the pixel’s colour is computed just once.'),
    scene('blend', 'Blend by coverage', 'A pixel with 2 of its 4 samples covered is 50% inside, so it’s drawn as a 50/50 blend of the triangle’s colour and the background. Across the edge the coverage runs 4/4 → 3/4 → 1/4 → 0, and the hard staircase turns into a smooth gradient — the same result supersampling gives, without the extra shading.'),
    scene('edges', 'Only the edges pay', 'Interior pixels are fully covered (4/4) or fully empty (0/4) — no blend, no extra cost. Only the handful of pixels an edge actually crosses do the coverage work, and none of them shade more than once. That efficiency is why MSAA became the standard antialiasing baked into GPUs.'),
    { key: 'run', title: 'Tilt the edge', caption: 'Rotate the triangle and toggle MSAA off and on. Off, the edge is a hard staircase of jaggies; on, the edge pixels blend by how much of each the triangle covers, and the line reads as smooth. The dots are the four coverage samples per pixel — the only extra work MSAA does, and only where an edge crosses.', render: () => <Grid phase="run" rot={rot} aa={aa} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A triangle on a pixel grid has a problem at its edges: each pixel is fully inside or fully outside, so a slanted edge turns into a staircase of jaggies — <strong>aliasing</strong>. The brute-force fix, <strong>supersampling</strong>, renders everything at several times the resolution and averages down, but that multiplies the cost of <em>shading</em> (textures, lighting), which is the expensive part. MSAA gets nearly the same smooth edges far more cheaply by separating two things a pixel does: figuring out how much of it the triangle covers, and computing its colour.</>,
        takeaway: <>MSAA takes several <strong>coverage</strong> samples per pixel — typically 4, at fixed sub-pixel positions — and for each just asks “is this point inside the triangle?”, giving a coverage fraction (2 of 4 = 50%). But it runs the expensive pixel <strong>shader only once</strong> per pixel and writes that one colour to every covered sample. The pixel’s final colour is the shaded colour blended against the background by its coverage, so an edge pixel comes out a smooth mix instead of a hard step (verified: the 4-sample coverage matches the true fraction of the pixel’s area inside the triangle to within one quantization step). The win is that interior pixels are fully in or fully out — no blending — so only the pixels an edge actually crosses do extra work, and none shade more than once. That’s the difference from supersampling, which shades every sub-sample. It’s why MSAA became the standard hardware antialiasing, later joined by post-process filters (FXAA) and temporal methods (TAA) that also tackle shader and sub-pixel aliasing, at the cost of a little blur.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="aa-ctl">
          <button type="button" className={`aa-btn ${!aa ? 'on' : ''}`} onClick={() => setAa(false)}>no AA</button>
          <button type="button" className={`aa-btn ${aa ? 'on' : ''}`} onClick={() => setAa(true)}>MSAA 4×</button>
          <label className="aa-lbl">tilt<input type="range" min={-40} max={40} value={Math.round(rot * 180 / Math.PI)} onChange={(e) => setRot(+e.target.value * Math.PI / 180)} /></label>
        </div>
      )}
    />
  );
}

function Grid({ phase, rot, aa }: { phase: Phase; rot: number; aa: boolean }) {
  const on = (p: Phase) => phase === p;
  const T = tri(rot);
  const showSamples = on('blend') || on('msaa') || on('run');
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="30" className="aa-col">triangle on a {GW}×{GH} pixel grid · {aa ? 'MSAA 4× (coverage-blended)' : 'no AA (hard in/out)'}</text>

      {/* pixels */}
      {Array.from({ length: GH }, (_, py) => Array.from({ length: GW }, (_, px) => {
        const cov = coverage(T, px, py);
        const edgePix = cov > 0 && cov < 1;
        const fill = aa ? mix(cov) : (inside(T, px + 0.5, py + 0.5) ? mix(1) : mix(0));
        return <rect key={`${px},${py}`} x={OX + px * PS} y={OY + py * PS} width={PS} height={PS} fill={fill}
          className={`aa-px ${on('edges') && edgePix ? 'edge' : ''}`} />;
      }))}

      {/* subsample dots on edge pixels */}
      {showSamples && Array.from({ length: GH }, (_, py) => Array.from({ length: GW }, (_, px) => {
        const cov = coverage(T, px, py); if (cov === 0 || cov === 1) return null;
        return S4.map(([dx, dy], i) => <circle key={`${px},${py},${i}`} cx={OX + (px + dx) * PS} cy={OY + (py + dy) * PS} r="2.4"
          className={`aa-samp ${inside(T, px + dx, py + dy) ? 'in' : 'out'}`} />);
      }))}

      {/* triangle outline */}
      <polygon points={T.map(([x, y]) => `${OX + x * PS},${OY + y * PS}`).join(' ')} className="aa-tri" />

      <text x="450" y="428" className="aa-foot" textAnchor="middle">
        {on('jagged') ? 'each pixel is fully in or out → slanted edges staircase'
          : on('super') ? 'supersampling smooths edges but shades 4–16× as many pixels'
          : on('msaa') ? '4 coverage samples per pixel, but the shader runs once'
          : on('blend') ? 'coverage 2/4 → 50% blend; the staircase becomes a gradient'
          : on('edges') ? 'only edge pixels (outlined) blend — interiors are free'
          : aa ? 'MSAA: edges blend by coverage — smooth, one shade per pixel' : 'no AA: hard jaggies along every slanted edge'}
      </text>
    </svg>
  );
}
