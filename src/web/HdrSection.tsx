// Guided story: HDR tone-mapping — fitting a scene's enormous brightness range onto a display. Real scenes span
// deep-shadow-to-sun (a factor of millions); a screen shows ~[0,1]. Clipping everything above 1 to white destroys the
// highlights; a tone-map operator compresses the whole range non-linearly instead. The Reinhard operator L/(1+L)
// sends 0→0 and ∞→1, keeping highlights distinct (verified in node: naive clip blows 3/5 test values to white,
// Reinhard maps all to distinct ordered values). Mimics the retina; then gamma-encodes (pairs with the gamma story).
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const W = 300, H = 190;
// synthetic HDR scene: bright sky gradient, a very bright sun, and a dark foreground silhouette
function lum(x: number, y: number): number {
  const nx = x / W, ny = y / H;
  let L = 0.12 + 9 * Math.pow(1 - ny, 2.2);        // sky: bright top, dim bottom
  const dx = nx - 0.72, dy = ny - 0.26, r2 = dx * dx + dy * dy;
  L += 120 * Math.exp(-r2 / 0.004);                 // the sun (very bright)
  if (ny > 0.72) L = 0.04 + 0.10 * nx;              // dark foreground silhouette
  if (nx > 0.10 && nx < 0.30 && ny > 0.40 && ny < 0.70) L = 2.5 + 6 * (0.70 - ny); // a bright window
  return L;
}
const clip = (L: number) => Math.min(1, L);
const reinhard = (L: number) => L / (1 + L);
const px = (Ld: number) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, Ld)), 1 / 2.2)); // display gamma
function render(mode: 'clip' | 'reinhard', exposure: number): string {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d')!; const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const L = lum(x, y) * exposure; const v = px(mode === 'clip' ? clip(L) : reinhard(L)); const i = (y * W + x) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return cv.toDataURL();
}

type Phase = 'range' | 'clip' | 'tonemap' | 'eye' | 'gamma' | 'run';

export function HdrSection() {
  const [exp, setExp] = useState(1);
  const both = useMemo(() => ({ clip: render('clip', exp), reinhard: render('reinhard', exp) }), [exp]);
  const base = useMemo(() => ({ clip: render('clip', 1), reinhard: render('reinhard', 1) }), []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Hdr phase={key} imgs={base} /> });

  const scenes: StoryScene[] = [
    scene('range', 'The world outshines your screen', 'A real scene spans a vast range of brightness — the deep shadow under a car to the direct sun is a factor of millions. But a display, and an 8-bit image, can only show a narrow range, roughly 0 to 1. How do you fit the sun and the shadow into the same picture?'),
    scene('clip', 'Clipping blows out the highlights', 'The naive answer: clamp everything brighter than 1 to pure white. But then all the detail in the bright regions is gone — the sky becomes a flat white blob, the window a white rectangle, and the sun and a lightbulb look identical. Everything above 1 collapses to the same white.'),
    scene('tonemap', 'Tone-map: compress, don’t clip', 'Instead, remap the whole range non-linearly. The Reinhard operator, L / (1 + L), sends 0 to 0 and infinity toward 1 — squeezing the bright end hard while barely touching the shadows. Now the sun, the sky, and the window are separate, visible tones, and the dark foreground keeps its detail too.'),
    scene('eye', 'It mimics your eye', 'Your retina does exactly this. It responds to ratios of light, not absolute amounts, compressing an enormous range into the signal it sends the brain — which is why you can see both the shadow under a car and the bright sky at the same time. Tone-mapping is a display-side version of that compression.'),
    scene('gamma', 'Then gamma-encodes it', 'Tone-mapping squeezes the scene’s light into 0–1; gamma encoding (the previous story) then packs that into 8-bit values perceptually. Together they’re the last stage of every renderer, game, and camera — turning a physical field of light into a picture that looks right on a screen.'),
    { key: 'run', title: 'Push the exposure', caption: 'Raise the exposure and watch the two approaches diverge: naive clipping (left) blows the sky and sun to a featureless white almost immediately, while Reinhard (right) keeps rolling the highlights back into range, holding detail everywhere. The curve shows why — clip is a hard corner at 1; Reinhard is a smooth approach to it.', render: () => <Hdr phase="run" imgs={both} exp={exp} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A real scene spans an enormous range of brightness — deep shadow to direct sun is a factor of millions — but a display, and an 8-bit image, can only show a narrow range of roughly 0 to 1. <strong>Tone-mapping</strong> fits that range onto the screen. The naive approach — clipping everything brighter than 1 to white — throws away all the highlight detail; tone-mapping instead remaps the whole range non-linearly so both the sun and the shadow stay visible.</>,
        takeaway: <>A tone-map operator takes scene luminance in [0, ∞) and squeezes it into [0, 1). The <strong>Reinhard</strong> operator is the classic: <code>displayed = L / (1 + L)</code>, which sends 0 to 0 and infinity toward 1, compressing the bright end hard while leaving shadows almost untouched — so luminances of 3, 40, and 4000 map to 0.75, 0.98, and ≈1.0, staying distinct and ordered instead of all clipping to white. This mirrors your retina, which responds to <em>ratios</em> of light rather than absolute amounts and so packs a vast range into the nerve signal it sends the brain (why you see the dark under a car and the bright sky at once). Tone-mapping is the compression step; <strong>gamma</strong> encoding then packs the resulting [0,1] into 8-bit values perceptually — together they are the final stage of every renderer, game, and camera. Production operators (ACES, Hable/Uncharted, extended Reinhard with a white point) add an S-curve for contrast, but the idea is the same: non-linearly compress the range instead of clipping it.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="hdr-ctl">exposure ×<input type="range" min={0.3} max={6} step={0.1} value={exp} onChange={(e) => setExp(+e.target.value)} /><b>{exp.toFixed(1)}×</b></label>
      )}
    />
  );
}

function Hdr({ phase, imgs, exp = 1 }: { phase: Phase; imgs: { clip: string; reinhard: string }; exp?: number }) {
  const on = (p: Phase) => phase === p;
  const solo = on('range') || on('clip') || on('eye') || on('gamma'); // single centered image
  const soloClip = on('clip');
  const soloImg = soloClip ? imgs.clip : imgs.reinhard;
  const soloLbl = soloClip ? 'naive clip — every value above 1 is white' : on('range') ? 'the scene, tone-mapped (what’s actually there)' : 'Reinhard — L / (1 + L)';
  // operator curve
  const CX = 340, CY = 408, CW = 220, CH = 140; const Lmax = 12;
  const cx = (L: number) => CX + (L / Lmax) * CW, cy = (v: number) => CY - v * CH;
  const line = (f: (L: number) => number) => { const p: string[] = []; for (let i = 0; i <= 60; i++) { const L = (i / 60) * Lmax; p.push(`${cx(L).toFixed(1)},${cy(f(L)).toFixed(1)}`); } return p.join(' '); };
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="30" className="hdr-col">HDR scene → display{on('run') ? ` · exposure ${exp.toFixed(1)}×` : ''}</text>

      {solo ? <>
        <text x="450" y="56" className={`hdr-lbl ${soloClip ? '' : 'ok'}`} textAnchor="middle">{soloLbl}</text>
        <image href={soloImg} x="270" y="66" width="360" height="228" className="hdr-img" />
        <rect x="270" y="66" width="360" height="228" className={`hdr-frame ${soloClip ? '' : 'ok'}`} />
      </> : <>
        <text x="230" y="56" className="hdr-lbl" textAnchor="middle">naive clip</text>
        <image href={imgs.clip} x="70" y="66" width="320" height="203" className="hdr-img" />
        <rect x="70" y="66" width="320" height="203" className="hdr-frame" />
        <text x="670" y="56" className="hdr-lbl ok" textAnchor="middle">Reinhard L/(1+L)</text>
        <image href={imgs.reinhard} x="510" y="66" width="320" height="203" className="hdr-img" />
        <rect x="510" y="66" width="320" height="203" className="hdr-frame ok" />
      </>}

      {/* operator curve (tonemap / run) */}
      {(on('tonemap') || on('run')) && <>
        <line x1={CX} y1={CY} x2={CX + CW} y2={CY} className="hdr-axis" /><line x1={CX} y1={CY} x2={CX} y2={CY - CH} className="hdr-axis" />
        <polyline points={line(clip)} className="hdr-clipcurve" fill="none" /><polyline points={line(reinhard)} className="hdr-reincurve" fill="none" />
        <text x={CX + CW + 6} y={cy(1)} className="hdr-clab">clip: hard 1</text>
        <text x={CX + CW + 6} y={cy(reinhard(Lmax)) + 4} className="hdr-rlab">Reinhard: smooth</text>
        <text x={CX + CW / 2} y={CY + 16} className="hdr-axlbl" textAnchor="middle">input luminance →</text>
      </>}

      <text x="450" y="452" className="hdr-foot" textAnchor="middle">
        {on('range') ? 'shadow-to-sun is millions to one; the screen shows about 0 to 1'
          : on('clip') ? 'everything above 1 clamps to white — highlight detail is gone'
          : on('tonemap') ? 'L/(1+L): sun, sky, window stay distinct; shadows barely move'
          : on('eye') ? 'the retina compresses ratios of light — tone-mapping does the same'
          : on('gamma') ? 'compress the range (tone-map), then perceptually encode (gamma)'
          : 'clip blows out fast; Reinhard rolls highlights back in and holds detail'}
      </text>
    </svg>
  );
}
