// Guided story #18: how ray tracing renders an image — cast a ray per pixel, intersect, shade, shadow, reflect. On
// the GuidedStory engine. A schematic on the left explains the mechanism; a REAL ray-traced image on the right shows
// the result (rendered on a canvas from actual ray-sphere/plane intersections + Lambert shading + shadow rays).
// Scenes: trace backwards from the eye, ray-object intersection, shading by the light, shadow rays, reflection, then
// a live light you drag and the whole image re-renders. Real geometry (nearest-hit, cos shading, shadow occlusion).
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V): V => scl(a, 1 / len(a));

const EYE: V = [0, 1.4, -3], SPH: V = [0, 1.2, 1.6], R = 1.0, PLANE = 0.2;
const iSph = (o: V, d: V) => { const oc = sub(o, SPH); const b = dot(oc, d); const c = dot(oc, oc) - R * R; const h = b * b - c; if (h < 0) return Infinity; const t = -b - Math.sqrt(h); return t > 1e-3 ? t : Infinity; };
const iPln = (o: V, d: V) => { if (Math.abs(d[1]) < 1e-6) return Infinity; const t = (PLANE - o[1]) / d[1]; return t > 1e-3 ? t : Infinity; };
function traceColor(d: V, light: V, reflect: boolean): V {
  const shootPrimary = (o: V, dir: V): { p: V; n: V; base: V } | null => {
    const ts = iSph(o, dir), tp = iPln(o, dir), t = Math.min(ts, tp);
    if (!isFinite(t)) return null;
    const p = add(o, scl(dir, t));
    if (ts < tp) return { p, n: norm(sub(p, SPH)), base: [0.95, 0.5, 0.4] };
    const chk = (Math.floor(p[0] * 1.2) + Math.floor(p[2] * 1.2)) & 1;
    return { p, n: [0, 1, 0], base: chk ? [0.55, 0.58, 0.62] : [0.32, 0.34, 0.4] };
  };
  const shade = (hit: { p: V; n: V; base: V }): V => {
    const toL = norm(sub(light, hit.p));
    const so = add(hit.p, scl(hit.n, 1e-3));
    const sh = iSph(so, toL); const inShadow = isFinite(sh) && sh < len(sub(light, hit.p));
    const diff = Math.max(0, dot(hit.n, toL));
    const b = inShadow ? 0.13 : 0.13 + 0.87 * diff;
    return scl(hit.base, b);
  };
  const hit = shootPrimary(EYE, d);
  if (!hit) return [0.05, 0.07, 0.11]; // background
  let col = shade(hit);
  if (reflect && hit.base[0] > 0.9) { // mirror the sphere
    const r = norm(sub(d, scl(hit.n, 2 * dot(d, hit.n))));
    const h2 = shootPrimary(add(hit.p, scl(hit.n, 1e-3)), r);
    if (h2) col = add(scl(col, 0.5), scl(shade(h2), 0.5));
  }
  return col;
}
function render(lightX: number, reflect: boolean): string {
  const W = 132, H = 96, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!; const img = ctx.createImageData(W, H); const light: V = [lightX, 4, -0.6];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i / W - 0.5) * 2.2 * (W / H), y = (0.5 - j / H) * 1.6;
    const c = traceColor(norm([x, y, 1]), light, reflect); const k = (j * W + i) * 4;
    img.data[k] = Math.min(255, c[0] * 255); img.data[k + 1] = Math.min(255, c[1] * 255); img.data[k + 2] = Math.min(255, c[2] * 255); img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return cv.toDataURL();
}

type Phase = 'idea' | 'hit' | 'shade' | 'shadow' | 'reflect' | 'run';

export function RaytraceSection() {
  const [lightX, setLightX] = useState(2.5);
  const [reflect, setReflect] = useState(false);
  const url = useMemo(() => render(lightX, reflect), [lightX, reflect]);
  const still = useMemo(() => render(2.5, false), []);
  const reflStill = useMemo(() => render(2.5, true), []);

  const scene = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <RT phase={key} url={key === 'reflect' ? reflStill : still} /> });

  const scenes: StoryScene[] = [
    scene('idea', 'Trace the light backwards', 'To turn a 3D scene into a 2D image, shoot a ray from the eye through each pixel and ask: what does it hit, and what colour is that point? It is light simulated in reverse — from the eye out into the scene, one ray per pixel.'),
    scene('hit', 'Find the nearest hit', 'For one ray, test it against every object and keep the closest intersection. Solving where a line meets a sphere is a quadratic; a plane is one division. The nearest hit is what is visible at that pixel; everything behind it is blocked.'),
    scene('shade', 'Shade by the light', 'Colour the hit point by how it faces the light: a surface pointing straight at the light is bright, one turned away is dark. Brightness follows the cosine of the angle between the surface normal and the direction to the light.'),
    scene('shadow', 'Shadows for free', 'From the hit point, shoot a second ray toward the light. If it strikes another object first, the light is blocked and the point is in shadow. That single extra ray is why ray tracing gets real, sharp shadows almost for nothing.'),
    scene('reflect', 'Reflections by recursion', 'For a mirror, bounce the ray off the surface and trace again — recursively rendering whatever the reflection sees. Each bounce is one more ray. Keep going and you get reflections, glass, and global illumination.'),
    { key: 'run', title: 'Move the light', caption: 'Drag the light across the scene and the whole image re-renders: the bright side of the sphere follows the light, and its shadow sweeps across the floor — every pixel re-traced. Toggle reflection to bounce a second ray off the sphere.', render: () => <RT phase="run" url={url} live={{ lightX, reflect }} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To turn a 3D scene into a 2D image, ray tracing shoots a ray from the eye out through each pixel and asks: what does this ray hit, and what colour is that point? It is light simulated in reverse — from the eye into the scene rather than from the lamp to the eye. This shows the mechanism beside a real image it renders from those rays.</>,
        takeaway: <>For each ray you find the nearest object it meets (a sphere is a quadratic, a plane a single division); that hit point is what’s visible at the pixel. You colour it by how squarely it faces the light — bright head-on, dark edge-on — and test for shadow by firing a second ray toward the light: if something blocks it, the point is shaded. A mirror simply bounces the ray and traces again, recursively. It is slower than rasterization because it is one-or-more rays per pixel, but shadows, reflections, and realistic lighting all fall out of the same short idea — which is why films render this way and GPUs now race to do it in real time.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="rtr-ctl">light<input type="range" min={-3} max={3} step={0.1} value={lightX} onChange={(e) => setLightX(Number(e.target.value))} /></label>
          <label className="rtr-ctl"><input type="checkbox" checked={reflect} onChange={(e) => setReflect(e.target.checked)} /> reflection</label>
        </>
      )}
    />
  );
}

function RT({ phase, url, live }: { phase: Phase; url: string; live?: { lightX: number; reflect: boolean } }) {
  const on = (p: Phase) => phase === p;
  const lx = live ? live.lightX : 2.5;
  const lightSx = 240 + lx * 34; // light x in the diagram
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* left: schematic */}
      <text x="60" y="60" className="rtr-col">the mechanism</text>
      <circle cx="55" cy="240" r="10" className="rtr-eye" /><text x="55" y="272" className="rtr-lbl" textAnchor="middle">eye</text>
      <line x1="120" y1="150" x2="120" y2="330" className="rtr-plane" /><text x="120" y="348" className="rtr-lbl" textAnchor="middle">pixels</text>
      <circle cx="300" cy="230" r="46" className="rtr-sphere" />
      <line x1="60" y1="238" x2="262" y2="222" className="rtr-ray primary" markerEnd="url(#rtr-arr)" />
      {on('hit') && <circle cx="258" cy="220" r="6" className="rtr-hitpt" />}
      {(on('shade') || on('shadow') || on('reflect')) && <>
        <line x1="258" y1="220" x2="228" y2="188" className="rtr-normal" />
        <line x1={258} y1={220} x2={lightSx} y2={110} className={`rtr-ray light ${on('shadow') ? 'shadowray' : ''}`} />
      </>}
      {on('reflect') && <line x1="258" y1="220" x2="140" y2="150" className="rtr-ray refl" markerEnd="url(#rtr-arr)" />}
      <circle cx={lightSx} cy="105" r="9" className="rtr-light" /><text x={lightSx} y="90" className="rtr-lbl" textAnchor="middle">☀ light</text>
      <line x1="40" y1="330" x2="420" y2="330" className="rtr-ground" />
      {on('shadow') && <ellipse cx="330" cy="332" rx="40" ry="7" className="rtr-shadow" />}

      {/* right: the rendered image */}
      <text x="660" y="60" className="rtr-col" textAnchor="middle">the rendered image (real rays)</text>
      <image href={url} x="500" y="80" width="360" height="262" className="rtr-img" preserveAspectRatio="none" />
      <rect x="500" y="80" width="360" height="262" rx="6" className="rtr-img-frame" />

      <text x="450" y="452" className="rtr-foot" textAnchor="middle">
        {on('idea') ? 'one ray per pixel, from the eye into the scene'
          : on('hit') ? 'nearest intersection wins — that point is what you see'
          : on('shade') ? 'brightness = cos(angle between the surface normal and the light)'
          : on('shadow') ? 'a blocked shadow ray means the point sits in shadow'
          : on('reflect') ? 'a mirror bounces the ray and traces recursively'
          : 'every pixel re-traced as you move the light'}
      </text>
      <defs><marker id="rtr-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="rtr-arrhead" /></marker></defs>
    </svg>
  );
}
