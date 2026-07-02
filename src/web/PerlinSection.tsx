// Perlin noise, made visible. The same field shown two ways: raw grayscale (smooth hills of light and dark) and
// mapped to a terrain palette (water → sand → grass → forest → rock → snow), so you can see procedural landscape
// fall straight out of the math. Add octaves to pile fine detail onto coarse shape; zoom and reseed to explore.
// Real logic from perlin.ts.
import { useEffect, useRef, useState } from 'react';
import { Perlin } from './perlin';

const CW = 340, CH = 220;

// terrain palette by height (fBm value)
function terrain(v: number): [number, number, number] {
  if (v < -0.28) return [30, 52, 96];    // deep water
  if (v < -0.12) return [46, 82, 140];   // water
  if (v < -0.02) return [200, 190, 130];  // sand
  if (v < 0.15) return [86, 140, 74];    // grass
  if (v < 0.32) return [52, 100, 56];    // forest
  if (v < 0.5) return [120, 116, 110];   // rock
  return [232, 236, 240];                // snow
}

export function PerlinSection() {
  const [seed, setSeed] = useState(42);
  const [zoom, setZoom] = useState(28); // larger = more zoomed out (lower frequency)
  const [octaves, setOctaves] = useState(5);
  const [mode, setMode] = useState<'terrain' | 'gray'>('terrain');
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
    const p = new Perlin(seed);
    const img = ctx.createImageData(CW, CH);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const v = p.fbm(x / zoom, y / zoom, octaves);
      const o = (y * CW + x) * 4;
      const [r, g, b] = mode === 'terrain' ? terrain(v) : (() => { const c = Math.round((v + 0.6) / 1.2 * 255); return [c, c, c] as [number, number, number]; })();
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [seed, zoom, octaves, mode]);

  return (
    <div className="pln">
      <p className="pln-intro">
        Random numbers per pixel give harsh <strong>white noise</strong>. Perlin noise is <strong>smooth</strong>:
        it assigns a random <strong>gradient</strong> (a direction) to each point of an integer grid, and for any
        query point blends the four surrounding gradients — dotted with the offset to each corner — using the fade
        curve <code>6t⁵−15t⁴+10t³</code>. The result has no jarring jumps, so it reads as gentle terrain. Stack
        <strong> octaves</strong> at doubling frequency for fractal detail.
      </p>

      <div className="pln-tabs">
        <button type="button" className={`pln-tab ${mode === 'terrain' ? 'on' : ''}`} onClick={() => setMode('terrain')}>terrain</button>
        <button type="button" className={`pln-tab ${mode === 'gray' ? 'on' : ''}`} onClick={() => setMode('gray')}>raw noise</button>
        <button type="button" className="pln-tab ghost" onClick={() => setSeed((s) => (s * 1103515245 + 12345) & 0x7fffffff)}>new seed</button>
      </div>

      <canvas ref={canvas} width={CW} height={CH} className="pln-canvas" />

      <div className="pln-controls">
        <label>zoom <input type="range" min={10} max={70} value={zoom} onChange={(e) => setZoom(+e.target.value)} /></label>
        <label>octaves <input type="range" min={1} max={6} value={octaves} onChange={(e) => setOctaves(+e.target.value)} /> <b>{octaves}</b></label>
        <span className="pln-hint">1 octave = smooth blobs · more octaves = rugged detail</span>
      </div>

      <p className="pln-foot">
        The single most important detail is that fade curve. A plain linear blend between cells would be continuous
        but have <em>kinks</em> at every grid line (the slope jumps), and your eye reads those as an ugly regular
        lattice; <code>6t⁵−15t⁴+10t³</code> is the lowest-degree polynomial that is flat in both its first AND
        second derivative at 0 and 1, so cells join with no visible seam. The other reason it looks natural is the
        octaves: real mountains are self-similar — big ridges carry medium spurs that carry small bumps — and
        summing noise at 1×, 2×, 4×, 8× frequency with 1, ½, ¼, ⅛ amplitude (fractional Brownian motion) reproduces
        exactly that fractal roughness; the amplitude falloff is the "fractal dimension" knob. Perlin later replaced
        this grid-based version with <strong>simplex noise</strong> (2001), which uses a triangular lattice to kill
        the faint axis-aligned artifacts and scale better to higher dimensions. Both power an enormous amount of
        what you see: Minecraft's terrain, cloud and marble and wood textures, the flicker of CG fire, camera-shake
        and hand-drawn wobble in animation, and displacement maps across visual effects. Randomness you can control
        turned out to be one of graphics' most valuable primitives. (Perlin, SIGGRAPH 1985 &amp; 2002.)
      </p>
    </div>
  );
}
