// Guided story: gamma correction — why pixel value 128 isn't half-bright, and why naive image math is physically
// wrong. Displays are non-linear: images store brightness perceptually (value ≈ light^(1/2.2), sRGB) because the eye
// resolves darks better. So value 128 emits only ~22% light; half the light is value ~188. Any operation that treats
// pixel values as light (average, opacity, resize, blur) is wrong unless you decode to linear first. Real sRGB
// encode/decode, verified in node (decode 128 = 0.216; half-light = 188; naive avg 128 vs correct 188). Sandboxed.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const dec = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; // sRGB → linear
const enc = (l: number) => { const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; return c * 255; }; // linear → sRGB
const gray = (v: number) => `rgb(${Math.round(v)},${Math.round(v)},${Math.round(v)})`;

const CORRECT = enc((dec(0) + dec(255)) / 2); // ≈ 188

type Phase = 'half' | 'bits' | 'squint' | 'wrong' | 'fix' | 'run';

export function GammaSection() {
  const [v, setV] = useState(128);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Gam phase={key} v={128} /> });

  const scenes: StoryScene[] = [
    scene('half', '128 is not half-bright', 'A pixel value of 128 looks far darker than half the brightness of white — because a display is deliberately non-linear. To actually emit half the light of full white, the stored value has to be about 188, not 128. Value 128 puts out only around 22% of the light.'),
    scene('bits', 'Vision spends bits on the dark', 'Your eye resolves changes in dark tones far better than in bright ones. So images encode brightness perceptually: the stored value is roughly the real light raised to the power 1/2.2 (sRGB gamma), packing most of the 0–255 range into the shadows where your eye needs the precision. It’s why 8 bits per channel look smooth instead of banded.'),
    scene('squint', 'The squint test', 'Fine black-and-white stripes emit, on average, half the light of solid white. Squint until they blur and they match the solid patch on the right — value 188 — not the 128 patch, which is visibly darker. Half the light lives near 188 in pixel values.'),
    scene('wrong', 'So pixel math is wrong', 'Averaging, opacity, resizing, blur, anti-aliasing — all add pixel values as if they were light. They aren’t. Average black (0) and white (255) directly and you get 128, a too-dark gray. The true midpoint of their light re-encodes to 188 — the gray your eye expects.'),
    scene('fix', 'Linearize, operate, re-encode', 'Correct image math decodes the values to linear light, does the operation there, then re-encodes to sRGB. That’s why renderers, compositors, and good image resamplers work in linear space — and why naive resizing leaves dark fringes around logos and blends come out muddy.'),
    { key: 'run', title: 'See the light behind a value', caption: 'Drag the pixel value and watch how little light it actually emits — the curve bends hard, so mid-range values are much darker than their number suggests. The swatch is how it looks; the readout is the physical light. And compare the two ways to average black and white: naive 128 is clearly darker than the correct 188.', render: () => <Gam phase="run" v={v} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A pixel value of 128 is not half as bright as 255 — displays are deliberately non-linear. Human vision resolves dark tones far better than bright ones, so images store brightness <em>perceptually</em>: the stored value is roughly the real light raised to the power 1/2.2 (sRGB gamma encoding), which packs more of the 0–255 range into the shadows where your eye needs it. The consequence is that pixel values are a perceptual code, not physical light — so to emit half the light you need a value near 188, and any math that treats pixel values as light is wrong.</>,
        takeaway: <>Encoding is roughly <code>value ≈ light^(1/2.2)</code> and decoding is <code>light ≈ value^2.2</code> (sRGB matches this closely, with a small linear segment near black). Because your eye is far more sensitive to changes in dark tones, spending the code perceptually keeps 8 bits per channel from banding in the shadows. But it means the numbers in an image are <strong>not proportional to light</strong>, so operations that assume linearity — averaging pixels, 50% opacity, resizing, blurring, alpha compositing, anti-aliasing — are physically wrong done directly on the encoded values: averaging 0 and 255 gives 128, but the true midpoint of their light re-encodes to about 188, so naive math comes out too dark and blends look muddy. The fix is always the same: <strong>decode to linear light, do the operation there, then re-encode</strong>. It’s why serious renderers and image resamplers work in linear space, and why the gap between correct and naive gamma handling shows up as dark fringes around resized logos and banded gradients.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="gam-ctl">pixel value<input type="range" min={0} max={255} value={v} onChange={(e) => setV(+e.target.value)} /><b>{v}</b> → emits <b>{(dec(v) * 100).toFixed(0)}%</b> light</label>
      )}
    />
  );
}

function Gam({ phase, v }: { phase: Phase; v: number }) {
  const on = (p: Phase) => phase === p;
  // gamma curve panel
  const CX = 70, CY = 340, CW = 360, CH = 260;
  const px = (val: number) => CX + (val / 255) * CW, py = (light: number) => CY - light * CH;
  const pts: string[] = []; for (let i = 0; i <= 64; i++) { const val = (i / 64) * 255; pts.push(`${px(val).toFixed(1)},${py(dec(val)).toFixed(1)}`); }
  const showCurve = on('half') || on('bits') || on('run');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="34" className="gam-col">{showCurve ? 'stored value (0–255) → light emitted (0–1)' : on('squint') ? 'squint until the stripes blur' : 'two ways to average black + white'}</text>

      {showCurve && <>
        {/* axes */}
        <line x1={CX} y1={CY} x2={CX + CW} y2={CY} className="gam-axis" /><line x1={CX} y1={CY} x2={CX} y2={CY - CH} className="gam-axis" />
        <line x1={CX} y1={CY} x2={CX + CW} y2={CY - CH} className="gam-diag" /> {/* linear reference */}
        <polyline points={pts.join(' ')} className="gam-curve" fill="none" />
        <text x={CX + CW - 4} y={CY - CH + 34} className="gam-difflbl" textAnchor="end">if it were linear</text>
        {/* 128 marker */}
        <line x1={px(128)} y1={CY} x2={px(128)} y2={py(dec(128))} className="gam-mark" /><circle cx={px(128)} cy={py(dec(128))} r="4" className="gam-dot" />
        <text x={px(128)} y={CY + 18} className="gam-tick" textAnchor="middle">128 → {(dec(128) * 100).toFixed(0)}%</text>
        {/* 188 marker */}
        <line x1={px(CORRECT)} y1={CY} x2={px(CORRECT)} y2={py(0.5)} className="gam-mark ok" /><circle cx={px(CORRECT)} cy={py(0.5)} r="4" className="gam-dot ok" />
        <text x={px(CORRECT)} y={CY + 34} className="gam-tick ok" textAnchor="middle">188 → 50%</text>
        {on('run') && <><line x1={px(v)} y1={CY} x2={px(v)} y2={py(dec(v))} className="gam-mark live" /><circle cx={px(v)} cy={py(dec(v))} r="5" className="gam-dot live" /></>}
        {/* right: swatch of the current value + its light */}
        <rect x="520" y="90" width="150" height="150" rx="8" style={{ fill: gray(on('run') ? v : 128) }} stroke="#0006" />
        <text x="595" y="262" className="gam-swlbl" textAnchor="middle">value {on('run') ? v : 128}</text>
        <rect x="700" y="90" width="150" height="150" rx="8" style={{ fill: gray(CORRECT) }} stroke="#0006" />
        <text x="775" y="262" className="gam-swlbl" textAnchor="middle">value 188 (½ light)</text>
      </>}

      {on('squint') && <>
        {/* black/white stripes */}
        {Array.from({ length: 40 }, (_, i) => <rect key={i} x={80 + i * 8} y={90} width="4" height="180" style={{ fill: gray(i % 2 ? 255 : 0) }} />)}
        <text x={240} y={296} className="gam-swlbl" textAnchor="middle">black+white stripes (½ light)</text>
        <rect x="470" y="90" width="150" height="180" rx="6" style={{ fill: gray(128) }} /><text x="545" y="296" className="gam-swlbl" textAnchor="middle">value 128 (too dark)</text>
        <rect x="670" y="90" width="150" height="180" rx="6" style={{ fill: gray(CORRECT) }} /><text x="745" y="296" className="gam-swlbl ok" textAnchor="middle">value 188 (matches)</text>
      </>}

      {(on('wrong') || on('fix')) && <>
        <rect x="120" y="80" width="130" height="130" rx="8" style={{ fill: gray(0) }} stroke="#333" /><text x="185" y="230" className="gam-swlbl" textAnchor="middle">black (0)</text>
        <text x="300" y="150" className="gam-op" textAnchor="middle">+</text>
        <rect x="360" y="80" width="130" height="130" rx="8" style={{ fill: gray(255) }} stroke="#333" /><text x="425" y="230" className="gam-swlbl" textAnchor="middle">white (255)</text>
        <text x="545" y="150" className="gam-op" textAnchor="middle">=</text>
        <rect x="600" y="80" width="115" height="130" rx="8" style={{ fill: gray(128) }} /><text x="657" y="230" className="gam-swlbl" textAnchor="middle">naive → 128</text>
        <rect x="725" y="80" width="115" height="130" rx="8" style={{ fill: gray(CORRECT) }} /><text x="782" y="230" className="gam-swlbl ok" textAnchor="middle">correct → 188</text>
        {on('fix') && <text x="450" y="264" className="gam-note" textAnchor="middle">decode → average the light → re-encode = 188, the gray your eye expects</text>}
      </>}

      <text x="450" y="452" className="gam-foot" textAnchor="middle">
        {on('half') ? 'the curve bends: value 128 emits only ~22% of full light'
          : on('bits') ? 'perceptual encoding — more code values packed into the dark tones'
          : on('squint') ? 'half the light matches value 188, not 128'
          : on('wrong') ? 'adding pixel values ≠ adding light → naive average is too dark'
          : on('fix') ? 'decode to linear, operate, re-encode — the only correct way'
          : `value ${v} emits ${(dec(v) * 100).toFixed(0)}% light · naive vs correct average of black+white`}
      </text>
    </svg>
  );
}
