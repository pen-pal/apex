// Guided story #19: how a GPU rasterizes a triangle — edge functions + barycentric interpolation, on the GuidedStory
// engine. The opposite of ray tracing (story #18): instead of one ray per pixel, take each triangle and find which
// pixels it covers. A schematic explains the inside test; a REAL rasterized triangle (rendered on a canvas with real
// edge functions and barycentric colour blending) shows the result. Scenes: the idea, project to 2D, edge-function
// inside test, barycentric interpolation, the z-buffer, then a live vertex you slide and the triangle re-rasterizes.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const V1: [number, number] = [24, 126], V2: [number, number] = [164, 120];
const C0 = [235, 70, 70], C1 = [70, 200, 100], C2 = [80, 130, 235];
const edge = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);

function render(apexX: number): string {
  const W = 190, H = 140, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!; const img = ctx.createImageData(W, H);
  const v0: [number, number] = [apexX, 12];
  const area = edge(v0[0], v0[1], V1[0], V1[1], V2[0], V2[1]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e0 = edge(V1[0], V1[1], V2[0], V2[1], x + 0.5, y + 0.5);
    const e1 = edge(V2[0], V2[1], v0[0], v0[1], x + 0.5, y + 0.5);
    const e2 = edge(v0[0], v0[1], V1[0], V1[1], x + 0.5, y + 0.5);
    const k = (y * W + x) * 4;
    if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) {
      const w0 = e0 / area, w1 = e1 / area, w2 = e2 / area;
      img.data[k] = w0 * C0[0] + w1 * C1[0] + w2 * C2[0];
      img.data[k + 1] = w0 * C0[1] + w1 * C1[1] + w2 * C2[1];
      img.data[k + 2] = w0 * C0[2] + w1 * C1[2] + w2 * C2[2];
      img.data[k + 3] = 255;
    } else { img.data[k] = 12; img.data[k + 1] = 16; img.data[k + 2] = 24; img.data[k + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0); return cv.toDataURL();
}
const covered = (apexX: number) => {
  const v0: [number, number] = [apexX, 12]; const area = edge(v0[0], v0[1], V1[0], V1[1], V2[0], V2[1]); let n = 0;
  for (let y = 0; y < 140; y++) for (let x = 0; x < 190; x++) { const e0 = edge(V1[0], V1[1], V2[0], V2[1], x, y), e1 = edge(V2[0], V2[1], v0[0], v0[1], x, y), e2 = edge(v0[0], v0[1], V1[0], V1[1], x, y); if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) n++; }
  return { n, area };
};

type Phase = 'idea' | 'project' | 'edges' | 'bary' | 'zbuf' | 'run';

export function RasterizeSection() {
  const [apexX, setApexX] = useState(95);
  const url = useMemo(() => render(apexX), [apexX]);
  const still = useMemo(() => render(95), []);
  const cov = covered(apexX);

  const scene = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Ras phase={key} url={key === 'run' ? url : still} apexX={key === 'run' ? apexX : 95} /> });

  const scenes: StoryScene[] = [
    scene('idea', 'The opposite of ray tracing', 'Ray tracing shoots a ray out through every pixel — gorgeous, but slow. For 60 frames a second a GPU flips it around: take each triangle and quickly work out which pixels it covers. That is rasterization, and a GPU does it for billions of triangles a second.'),
    scene('project', 'Project the triangle to 2D', 'A 3D model is millions of triangles. Each triangle’s three corners are projected from 3D onto flat screen positions, and now the whole job is a 2D question: which pixels fall inside this triangle?'),
    scene('edges', 'The inside test: three edge functions', 'For a pixel, compute three edge functions — one per edge — each just a cross product telling you which side of that edge the pixel is on. If the pixel is on the inside of all three edges, it is inside the triangle. That is a few multiply-adds per pixel, and every pixel is independent — which is exactly why a GPU has thousands of tiny cores.'),
    scene('bary', 'Colour by barycentric weights', 'Those same three edge values, divided by the triangle’s area, are barycentric weights: how much each corner contributes at that pixel. Blend the corners’ colours by those weights and the colour varies smoothly across the triangle. The identical trick interpolates depth, texture coordinates, and surface normals.'),
    scene('zbuf', 'The z-buffer sorts overlaps', 'When triangles overlap, which one wins a pixel? Interpolate each triangle’s depth at that pixel and keep the nearest in a z-buffer, overwriting only if the new fragment is closer. So triangles can be drawn in any order and the nearest surface still shows through.'),
    { key: 'run', title: 'Slide a vertex', caption: 'Drag the top vertex and the triangle re-rasterizes: the coverage recomputes with the edge test, and the colour re-blends from the corners by barycentric weight. Every filled pixel is one independent inside-test-plus-blend — the work a GPU spreads across its cores.', render: () => <Ras phase="run" url={url} apexX={apexX} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A GPU draws a 3D world by breaking it into millions of triangles and, for each one, working out which screen pixels it covers and what colour they should be — the exact opposite of ray tracing’s one-ray-per-pixel. Doing it per-triangle, with a dead-simple parallel inside test, is what makes it fast enough for real-time games.</>,
        takeaway: <>For every pixel, three edge functions (a sign per triangle edge) decide whether it is inside all three edges — a handful of multiply-adds, and each pixel is fully independent, which is why a GPU packs thousands of tiny cores instead of a few fast ones. Those same three values, normalized, are barycentric weights that smoothly blend the corners’ colours, depths, and texture coordinates across the face. Overlapping triangles are resolved by a z-buffer keeping the nearest at each pixel. Rasterization trades away ray tracing’s easy shadows and reflections for raw speed — which is why games rasterize first and layer ray tracing on top only where it counts.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="ras-ctl">top vertex ↔<input type="range" min={-10} max={185} value={apexX} onChange={(e) => setApexX(Number(e.target.value))} /></label>
          <span className="ras-live">{cov.n.toLocaleString()} pixels covered</span>
        </>
      )}
    />
  );
}

function Ras({ phase, url, apexX }: { phase: Phase; url: string; apexX: number }) {
  const on = (p: Phase) => phase === p;
  // schematic triangle coords (in the 0..900 / 0..480 svg space, left half)
  const sx = (t: number) => 60 + t * 1.9, sy = (t: number) => 90 + t * 1.9;
  const v0 = [sx(apexX), sy(12)], v1 = [sx(V1[0]), sy(V1[1])], v2 = [sx(V2[0]), sy(V2[1])];
  const testP = [sx(90), sy(85)];
  const inside = on('edges') || on('bary');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="60" className="ras-col">the mechanism</text>
      <polygon points={`${v0[0]},${v0[1]} ${v1[0]},${v1[1]} ${v2[0]},${v2[1]}`} className="ras-tri" />
      {['#eb4646', '#46c864', '#5082eb'].map((c, i) => <circle key={i} cx={[v0, v1, v2][i][0]} cy={[v0, v1, v2][i][1]} r="8" fill={c} className="ras-vtx" />)}
      {(on('edges') || on('bary')) && <>
        <circle cx={testP[0]} cy={testP[1]} r="6" className="ras-testpt" />
        <text x={testP[0] + 12} y={testP[1] + 4} className={`ras-inside ${inside ? 'yes' : ''}`}>inside all 3 edges ✓</text>
      </>}
      {on('bary') && <>
        <line x1={v0[0]} y1={v0[1]} x2={testP[0]} y2={testP[1]} className="ras-bline" />
        <line x1={v1[0]} y1={v1[1]} x2={testP[0]} y2={testP[1]} className="ras-bline" />
        <line x1={v2[0]} y1={v2[1]} x2={testP[0]} y2={testP[1]} className="ras-bline" />
      </>}
      <text x="230" y="410" className="ras-lbl" textAnchor="middle">{on('edges') ? 'is the pixel inside every edge?' : on('bary') ? 'weights from the 3 corners' : 'one projected triangle'}</text>

      <text x="660" y="60" className="ras-col" textAnchor="middle">the rasterized result (real)</text>
      <image href={url} x="500" y="80" width="360" height="266" className="ras-img" preserveAspectRatio="none" />
      <rect x="500" y="80" width="360" height="266" rx="6" className="ras-img-frame" />

      <text x="450" y="452" className="ras-foot" textAnchor="middle">
        {on('idea') ? 'per-triangle, not per-ray — the trade that buys real-time speed'
          : on('project') ? '3D corners → 2D screen positions → a coverage question'
          : on('edges') ? 'three sign tests per pixel, every pixel independent'
          : on('bary') ? 'the edge values are the blend weights — colour, depth, texture'
          : on('zbuf') ? 'nearest depth wins each pixel, so draw order does not matter'
          : `${covered(apexX).n.toLocaleString()} pixels inside — each an independent test + blend`}
      </text>
    </svg>
  );
}
