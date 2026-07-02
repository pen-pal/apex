// Poisson-disk sampling, made visible. Flip between blue noise (Bridson's algorithm — every point at least r from
// its neighbours, faint exclusion disks tiling the plane) and plain random "white noise" at the SAME count, and
// the difference is obvious: white noise clumps and leaves holes, blue noise covers evenly. The min-distance stat
// makes it quantitative. Real logic from poisson.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { poissonDisk, whiteNoise } from './poisson';

const CW = 340, CH = 236;

export function PoissonSection() {
  const [r, setR] = useState(16);
  const [seed, setSeed] = useState(42);
  const [mode, setMode] = useState<'blue' | 'white'>('blue');
  const canvas = useRef<HTMLCanvasElement>(null);

  const blue = useMemo(() => poissonDisk(CW, CH, r, seed), [r, seed]);
  const white = useMemo(() => whiteNoise(CW, CH, blue.length, seed), [blue.length, seed]);
  const pts = mode === 'blue' ? blue : white;

  const minD = useMemo(() => {
    let m = Infinity;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    return m === Infinity ? 0 : m;
  }, [pts]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = '#0d1017'; ctx.fillRect(0, 0, CW, CH);
    if (mode === 'blue') { // faint exclusion disks (radius r/2 — they tile without overlapping)
      ctx.fillStyle = 'rgba(90,140,220,0.10)';
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, r / 2, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = mode === 'blue' ? '#7ea8f0' : '#e0a06a';
    for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, 7); ctx.fill(); }
  }, [pts, mode, r]);

  return (
    <div className="pds">
      <p className="pds-intro">
        Scatter points uniformly at random and they <strong>clump</strong> and leave gaps — "white noise," which
        makes shadows splotchy and antialiasing grainy. <strong>Poisson-disk</strong> sampling gives "blue noise":
        every point at least <strong>r</strong> from every other, yet the area stays evenly covered. Bridson's
        algorithm does it in O(n) by firing candidate darts into the ring between r and 2r around active points, and
        checking spacing in O(1) via a background grid. Flip the two and compare:
      </p>

      <div className="pds-tabs">
        <button type="button" className={`pds-tab ${mode === 'blue' ? 'on' : ''}`} onClick={() => setMode('blue')}>blue noise (Poisson)</button>
        <button type="button" className={`pds-tab ${mode === 'white' ? 'on' : ''}`} onClick={() => setMode('white')}>white noise (random)</button>
        <button type="button" className="pds-tab ghost" onClick={() => setSeed((x) => (Math.imul(x, 1103515245) + 12345) & 0x7fffffff)}>new seed</button>
      </div>

      <canvas ref={canvas} width={CW} height={CH} className="pds-canvas" />

      <div className="pds-controls">
        <label>min spacing r <input type="range" min={8} max={34} value={r} onChange={(e) => setR(+e.target.value)} /> <b>{r}</b></label>
        <div className="pds-stat"><span>points</span> <b>{pts.length}</b></div>
        <div className={`pds-stat ${minD >= r - 0.01 ? 'ok' : 'bad'}`}><span>min distance</span> <b>{minD.toFixed(1)}</b><small>{mode === 'blue' ? `≥ r=${r} ✓` : `≪ r=${r}`}</small></div>
      </div>

      <p className="pds-foot">
        The two knobs in Bridson's method both matter. The <em>annulus</em> [r, 2r] is a Goldilocks choice: a
        candidate closer than r would be rejected outright, and one farther than 2r would tend to leave a gap big
        enough for yet another point, hurting the even coverage — sampling between them packs tightly while staying
        legal. The <em>grid</em> is what turns the naive O(n²) "check against every existing point" into O(n): with
        cells of side r/√2 the diagonal of a cell is exactly r, so no cell can hold two valid samples, and any
        point within r of a candidate must lie in the 5×5 block of cells around it — a constant-size check. Why
        does the eye prefer it? Blue noise has almost no energy at low spatial frequencies, so the errors it
        produces in sampling are pushed up into high frequencies your visual system discards, instead of the
        low-frequency splotches white noise makes; that's why it's the sampling of choice for Monte-Carlo
        rendering, dithering, and stippled art, and why evolution arranged the light-sensing cones in your retina
        in very nearly a blue-noise pattern. Related methods trade quality for speed — Mitchell's best-candidate,
        Wang tiles, and precomputed blue-noise textures — but Bridson's is the simple one that just works.
        (Bridson, SIGGRAPH 2007; Ulichney on blue noise, 1987.)
      </p>
    </div>
  );
}
