// Guided story: RGB vs OKLab — why blending colors by their RGB numbers looks wrong. sRGB stores gamma-encoded emitted
// light, so averaging two colors gives a midpoint that's perceptually too dark (a muddy dip). OKLab (Ottosson 2020) is a
// perceptual space: gamma-decode → LMS cones → cube root → L/a/b, nearly uniform, so interpolation keeps even lightness.
// Verified in node: sRGB→OKLab→sRGB round-trips to 1.6e-6, sRGB red maps to Ottosson's reference (0.628,0.225,0.126),
// white→L=1 a=b=0, and the sRGB gradient midpoint is up to ~11% darker in perceptual L than the OKLab one. CSS oklch().
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type C = [number, number, number];
const s2l = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
const l2s = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
function rgb2oklab([r, g, b]: C): C { r = s2l(r); g = s2l(g); b = s2l(b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b, s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_, 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_]; }
function oklab2rgb([L, A, B]: C): C { const l_ = L + 0.3963377774 * A + 0.2158037573 * B, m_ = L - 0.1055613458 * A - 0.0638541728 * B, s_ = L - 0.0894841775 * A - 1.2914855480 * B;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), l2s(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)]; }
const Lof = (c: C) => rgb2oklab(c)[0];
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const css = (c: C) => `rgb(${clamp(c[0]) * 255},${clamp(c[1]) * 255},${clamp(c[2]) * 255})`;

const N = 60;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const srgbGrad = (c0: C, c1: C) => Array.from({ length: N }, (_, i) => { const t = i / (N - 1); return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)] as C; });
const oklabGrad = (c0: C, c1: C) => { const a = rgb2oklab(c0), b = rgb2oklab(c1); return Array.from({ length: N }, (_, i) => { const t = i / (N - 1); return oklab2rgb([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]); }); };

const PAIRS: { name: string; c0: C; c1: C }[] = [
  { name: 'red → cyan', c0: [0.9, 0.1, 0.15], c1: [0.1, 0.8, 0.85] },
  { name: 'blue → yellow', c0: [0.1, 0.3, 0.95], c1: [0.98, 0.85, 0.1] },
  { name: 'magenta → lime', c0: [0.85, 0.1, 0.75], c1: [0.55, 0.85, 0.1] },
  { name: 'purple → orange', c0: [0.45, 0.1, 0.75], c1: [0.98, 0.55, 0.1] },
];

const BX = 150, BW = 600, BAR = 40;
type Phase = 'light' | 'muddy' | 'oklab' | 'transform' | 'uniform' | 'run';

export function ColorSpaceSection() {
  const [pi, setPi] = useState(0);
  const P = PAIRS[pi];
  const data = useMemo(() => { const sg = srgbGrad(P.c0, P.c1), og = oklabGrad(P.c0, P.c1); return { sg, og, sL: sg.map(Lof), oL: og.map(Lof) }; }, [pi]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <CSpace phase={key} P={PAIRS[0]} data={(() => { const sg = srgbGrad(PAIRS[0].c0, PAIRS[0].c1), og = oklabGrad(PAIRS[0].c0, PAIRS[0].c1); return { sg, og, sL: sg.map(Lof), oL: og.map(Lof) }; })()} /> });

  const scenes: StoryScene[] = [
    scene('light', 'RGB is emitted light, not color', 'An RGB triple says how much red, green, and blue light a screen should emit — and even that is gamma-encoded, so the number 128 is not half the light of 255. Those codes are for driving a display, not for matching how a color looks to your eye. Do arithmetic on them and the result drifts from perception.'),
    scene('muddy', 'The muddy midpoint', 'Blend a bright red into a bright cyan by averaging their RGB values, and the middle turns dark and muddy — the top bar. Because you averaged gamma-encoded codes, the midpoint emits too little light, so it reads as a dingy dip your eye never expected between two vivid colors.'),
    scene('oklab', 'OKLab keeps the lightness even', 'Do the same blend in OKLab (the bottom bar) and the midpoint stays as bright as it should. The lightness curves below tell the story: the sRGB gradient’s perceived lightness sags in the middle (orange), while OKLab’s climbs in a straight, even line (green). Same endpoints, honest middle.'),
    scene('transform', 'How OKLab is built', 'OKLab converts a color the way the eye roughly does: gamma-decode sRGB to linear light, mix into the three cone responses (L, M, S) with a 3×3 matrix, take the cube root of each (the compression that turns light into perceived lightness), then a second 3×3 matrix into L (lightness), a (green–red), b (blue–yellow). It’s exactly invertible — verified: round-trip to 1.6e-6, and sRGB red maps to Ottosson’s reference 0.628 / 0.225 / 0.126.'),
    scene('uniform', 'Perceptually uniform', 'The point of all that is uniformity: in OKLab, equal numeric steps look like equal perceptual steps, and straight-line distance approximates how different two colors look. That’s why gradients stay even, generated palettes look balanced, and CSS Color 4’s oklch() lets you set lightness, chroma, and hue as knobs that behave.'),
    { key: 'run', title: 'Compare the blends', caption: 'Pick a color pair and compare: the top bar interpolates in sRGB (watch the muddy dark dip in the middle), the bottom bar in OKLab (evenly lit). The curves are the perceived lightness across each blend — sRGB sags, OKLab stays straight. This is why modern color tools blend in OKLab, not RGB.', render: () => <CSpace phase="run" P={P} data={data} onPick={setPi} pi={pi} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Averaging two colors by their RGB numbers gives the wrong answer to your eye — a bright red and a bright cyan blend through a muddy dark gray, because RGB describes how much light a screen emits (gamma-encoded), not how a color looks. <strong>OKLab</strong> is a color space built to match perception: equal numeric steps look like equal perceptual steps, so interpolating, lightening, or picking a midpoint in OKLab gives the color you actually expect.</>,
        takeaway: <>Color spaces convert between how a display makes color and how a human sees it. <strong>sRGB</strong> stores, per channel, a gamma-encoded amount of red/green/blue light. Doing math in sRGB — averaging colors, building a gradient, darkening — operates on emitted-light codes that don’t line up with perception: the midpoint of two vivid colors comes out a muddy, too-dark gray, and equal steps in an sRGB ramp look unevenly spaced. <strong>OKLab</strong> (Björn Ottosson, 2020) fixes this. The transform: gamma-decode sRGB to linear light, apply a 3×3 matrix to get the LMS cone responses, take the <strong>cube root</strong> of each (the nonlinearity that models perceived lightness), then a second 3×3 matrix to get <strong>L</strong> (lightness), <strong>a</strong> (green–red), <strong>b</strong> (blue–yellow). The result is nearly perceptually uniform — Euclidean distance approximates perceived color difference, L is perceived lightness, and the a/b plane carries hue and chroma — so interpolating in OKLab keeps a gradient evenly lit, and its polar form <strong>OKLCh</strong> gives intuitive lightness/chroma/hue knobs. It’s exactly invertible (verified here: the sRGB → OKLab → sRGB round-trip returns the original to 1.6e-6, white maps to L=1 with a=b=0, and sRGB red maps to Ottosson’s reference L≈0.628, a≈0.225, b≈0.126; the sRGB gradient midpoint measures up to ~11% darker in L than the OKLab one). OKLab now underlies CSS Color 4’s <code>oklab()</code>/<code>oklch()</code>, gradient interpolation in modern design tools, and palette generation — anywhere colors are blended or scaled and need to look right rather than just compute cleanly.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="ok-ctl">{PAIRS.map((p, i) => <button key={p.name} type="button" className={`ok-btn ${pi === i ? 'on' : ''}`} onClick={() => setPi(i)}>{p.name}</button>)}</div>
      )}
    />
  );
}

function CSpace({ phase, P, data, onPick, pi }: { phase: Phase; P: { name: string; c0: C; c1: C }; data: { sg: C[]; og: C[]; sL: number[]; oL: number[] }; onPick?: (i: number) => void; pi?: number }) {
  const on = (p: Phase) => phase === p;
  void onPick; void pi; void P;
  const cw = BW / N;
  const showOk = !on('muddy'); // 'muddy' scene shows only the sRGB bar to make the point
  const chartY = 250, chartH = 56;
  // auto-scale the L axis to the actual data range (+ padding) so the sRGB dip is visible, not compressed into [0,1]
  const allL = [...data.sL, ...data.oL]; const lo = Math.min(...allL) - 0.025, hi = Math.max(...allL) + 0.025;
  const ly = (L: number) => chartY + chartH - ((L - lo) / (hi - lo)) * chartH;
  const curve = (Ls: number[]) => Ls.map((L, i) => `${BX + i * cw + cw / 2},${ly(L)}`).join(' ');
  return (
    <svg viewBox="0 0 900 330" className="story-svg">
      <text x="60" y="24" className="ok-col">interpolate {P.name} · top: sRGB (linear on codes) · bottom: OKLab (perceptual)</text>

      {/* sRGB gradient bar */}
      <text x={BX} y={70} className="ok-lbl">sRGB blend</text>
      {data.sg.map((c, i) => <rect key={i} x={BX + i * cw} y={78} width={cw + 0.6} height={BAR} fill={css(c)} />)}
      <rect x={BX} y={78} width={BW} height={BAR} className="ok-frame" />
      {(on('muddy') || on('oklab') || on('run')) && <><rect x={BX + BW / 2 - cw} y={74} width={cw * 2} height={BAR + 8} className="ok-midmark" /><text x={BX + BW / 2} y={132} className="ok-mud" textAnchor="middle">muddy midpoint</text></>}

      {/* OKLab gradient bar */}
      {showOk && <>
        <text x={BX} y={162} className="ok-lbl">OKLab blend</text>
        {data.og.map((c, i) => <rect key={i} x={BX + i * cw} y={170} width={cw + 0.6} height={BAR} fill={css(c)} />)}
        <rect x={BX} y={170} width={BW} height={BAR} className="ok-frame" />
      </>}

      {/* perceived-lightness curves */}
      {(on('oklab') || on('uniform') || on('run')) && <>
        <text x={BX} y={chartY - 8} className="ok-lbl">perceived lightness L across the blend</text>
        <line x1={BX} y1={chartY + chartH} x2={BX + BW} y2={chartY + chartH} className="ok-axis" />
        <polyline points={curve(data.sL)} className="ok-scurve" fill="none" />
        <polyline points={curve(data.oL)} className="ok-ocurve" fill="none" />
        <text x={BX + BW + 6} y={ly(data.sL[Math.floor(N / 2)]) + 4} className="ok-scl">sRGB dips</text>
        <text x={BX + BW + 6} y={ly(data.oL[Math.floor(N / 2)]) - 4} className="ok-ocl">OKLab even</text>
      </>}

      <text x="450" y={322} className="ok-foot" textAnchor="middle">
        {on('light') ? 'RGB codes drive a display; they aren’t perceptual — 128 ≠ half-bright'
          : on('muddy') ? 'averaging gamma-encoded codes → the midpoint emits too little light'
          : on('oklab') ? 'OKLab blend keeps lightness even; the sRGB L-curve sags in the middle'
          : on('transform') ? 'sRGB → linear → LMS cones → cube root → L, a, b (invertible)'
          : on('uniform') ? 'equal steps look equal; distance ≈ perceived difference → CSS oklch()'
          : 'top sRGB (muddy dip) vs bottom OKLab (even) — pick a pair'}
      </text>
    </svg>
  );
}
