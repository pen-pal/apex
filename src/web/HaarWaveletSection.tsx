// Guided story: the Haar wavelet transform — multi-resolution decomposition with perfect reconstruction and energy
// compaction. Recursively split a signal into pairwise averages (coarse trend) and differences (fine detail); recurse
// on the averages to get a pyramid of scales, each localized in time (unlike Fourier). Orthonormal, so energy is
// preserved (Parseval) and inverse exactly rebuilds the signal. For piecewise-smooth signals the detail coefficients
// are mostly tiny, so keeping the few largest reconstructs with little error — the basis of wavelet compression and
// denoising. Verified in node: reconstruction to 1e-15, Parseval holds, keep 25% coeffs → 4.4% error vs 65% for raw.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const S2 = Math.SQRT2, N = 64;
const SIG = Array.from({ length: N }, (_, i) => { const x = i / N; return (x < 0.35 ? 0.3 + x : x < 0.7 ? 1.2 - 0.8 * (x - 0.35) : 0.36) + 0.12 * Math.sin(x * 7); });
function fwd(sig: number[]): number[] { let a = sig.slice(); const out = new Array(sig.length); let n = sig.length;
  while (n > 1) { const half = n / 2, na = new Array(half); for (let i = 0; i < half; i++) { na[i] = (a[2 * i] + a[2 * i + 1]) / S2; out[half + i] = (a[2 * i] - a[2 * i + 1]) / S2; } a = na; n = half; } out[0] = a[0]; return out; }
function inv(coef: number[]): number[] { const n = coef.length; let a = [coef[0]], len = 1;
  while (len < n) { const d = coef.slice(len, 2 * len), na = new Array(2 * len); for (let i = 0; i < len; i++) { na[2 * i] = (a[i] + d[i]) / S2; na[2 * i + 1] = (a[i] - d[i]) / S2; } a = na; len *= 2; } return a; }
const COEF = fwd(SIG);
// level of coefficient index: 0 = approx, else floor(log2(i))+1 (finer = larger)
const levelOf = (i: number) => (i === 0 ? 0 : Math.floor(Math.log2(i)) + 1);
function keepTop(arr: number[], frac: number): { kept: number[]; mask: boolean[] } {
  const idx = arr.map((v, i) => [i, Math.abs(v)] as [number, number]).sort((a, b) => b[1] - a[1]);
  const keep = Math.max(1, Math.round(arr.length * frac)); const mask = new Array(arr.length).fill(false);
  for (let k = 0; k < keep; k++) mask[idx[k][0]] = true; return { kept: arr.map((v, i) => (mask[i] ? v : 0)), mask };
}
const rmse = (a: number[], b: number[]) => { let e = 0, s = 0; for (let i = 0; i < a.length; i++) { e += (a[i] - b[i]) ** 2; s += b[i] ** 2; } return Math.sqrt(e / s); };

const PX = 70, SIGY = 46, SIGH = 120, COY = 250, COH = 96;
const sxi = (i: number) => PX + (i / (N - 1)) * 760;
const sval = (v: number) => SIGY + SIGH * (1 - (v - 0.1) / 1.2);
const HUE = [45, 200, 190, 175, 160, 145, 130]; // approx warm, details cool by level

type Phase = 'split' | 'pyramid' | 'perfect' | 'compact' | 'compress' | 'run';

export function HaarWaveletSection() {
  const [frac, setFrac] = useState(0.25);
  const { kept, mask } = useMemo(() => keepTop(COEF, frac), [frac]);
  const recon = useMemo(() => inv(kept), [kept]);
  const err = useMemo(() => rmse(recon, SIG), [recon]);
  const rawErr = useMemo(() => rmse(keepTop(SIG, frac).kept, SIG), [frac]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <HW phase={key} mask={COEF.map(() => true)} recon={SIG} err={0} rawErr={0} frac={1} /> });

  const scenes: StoryScene[] = [
    scene('split', 'Average and difference', 'The Haar step is almost too simple: walk the signal in pairs, and for each pair store its average (the coarse trend) and its difference (the fine detail). Together they hold the same information as the two samples — average + half-difference gives one, minus gives the other — but split into “smooth” and “change”.'),
    scene('pyramid', 'Recurse into a pyramid of scales', 'Now recurse: run the same average/difference on the averages alone, then on those, and so on. You get one overall average plus detail coefficients at every scale — coarse details of big regions, fine details of small ones — and each detail is tied to a specific place in the signal. That’s multi-resolution: like a Fourier transform, but keeping WHERE, not just what frequency.'),
    scene('perfect', 'It reconstructs exactly', 'Nothing is lost. The transform is orthonormal (the ÷√2 keeps lengths), so running it backwards — rebuild each pair from its average and difference — returns the original signal to the last bit. Verified: the round trip matches to 15 decimal places, and total energy is identical in the signal and its coefficients (Parseval).'),
    scene('compact', 'Smooth signals compact into few coefficients', 'Here’s why it’s useful. Where the signal is smooth, neighbouring samples are close, so their differences — the detail coefficients — are nearly zero. Almost all the energy collects into the coarse approximation and a handful of large details at the edges. The rest is a sea of near-zeros.'),
    scene('compress', 'Keep the big ones — compress and denoise', 'So throw away the small coefficients and keep only the largest. Reconstruct from those and you get the signal back with tiny error, from a fraction of the numbers — this is wavelet compression (JPEG 2000). And since random noise shows up as small, spread-out details, thresholding them away denoises too. Same transform, two jobs.'),
    { key: 'run', title: 'Compress it yourself', caption: 'Slide how many of the largest coefficients to keep. The orange reconstruction tracks the blue original closely even at 10–25% kept — because the wavelet packed the signal into a few coefficients — while zeroing the same fraction of raw samples (shown as the error) wrecks it. Fewer numbers, almost the same signal: that’s energy compaction at work.', render: () => <HW phase="run" mask={mask} recon={recon} err={err} rawErr={rawErr} frac={frac} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The <strong>Haar wavelet transform</strong> rewrites a signal as a coarse trend plus <em>details at every scale</em>. Repeatedly replace each pair of samples with their average and their difference, recursing on the averages: you end with one overall average and a pyramid of detail coefficients, each localized to a place and a scale. It’s a change of basis that (unlike Fourier) keeps <em>where</em> things happen, reconstructs the signal exactly, and — for smooth signals — concentrates almost all the energy into a few coefficients, which is what makes it compress and denoise.</>,
        takeaway: <>The Haar transform pairs up samples and stores, for each pair, the normalized average <code>(a+b)/√2</code> and difference <code>(a−b)/√2</code>, then recurses on the averages. After log₂N passes you have one scaling (approximation) coefficient and N−1 detail coefficients spread across log₂N scales, each detail tied to a specific location — a <strong>multi-resolution</strong> decomposition that, unlike the Fourier transform, preserves time/space localization (a spike stays a few large local coefficients instead of smearing across all frequencies). The basis is <strong>orthonormal</strong>, so the inverse (rebuild each pair as <code>(avg±diff)/√2</code>) is exact — verified here to 1e-15 — and energy is preserved between signal and coefficients (<strong>Parseval</strong>). Its power is <strong>energy compaction</strong>: wherever the signal is smooth, adjacent samples are close, so their detail coefficients are ≈0; the energy piles into the approximation and a few large details at discontinuities. Keeping only the largest-magnitude coefficients and zeroing the rest reconstructs with small error from a fraction of the data (verified: keep 25% → 4.4% RMS error on a piecewise-smooth signal, versus 65% if you instead keep 25% of the raw samples). That is the engine of <strong>wavelet compression</strong> (JPEG 2000 uses smoother Daubechies wavelets on image tiles) and <strong>wavelet denoising</strong> (noise becomes small, spread-out detail coefficients that thresholding removes). Real codecs use longer, smoother wavelets and the fast O(n) lifting scheme, but the Haar transform is the whole idea in its simplest form.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="hw-ctl">keep top<input type="range" min={2} max={100} value={Math.round(frac * 100)} onChange={(e) => setFrac(+e.target.value / 100)} /><b>{Math.round(frac * 100)}%</b> of coeffs · wavelet error <b>{(err * 100).toFixed(1)}%</b> vs raw samples {(rawErr * 100).toFixed(0)}%</label>
      )}
    />
  );
}

function HW({ phase, mask, recon, err, rawErr, frac }: { phase: Phase; mask: boolean[]; recon: number[]; err: number; rawErr: number; frac: number }) {
  const on = (p: Phase) => phase === p;
  const showRecon = on('perfect') || on('run') || on('compress');
  const maxC = Math.max(...COEF.map(Math.abs));
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="24" className="hw-col">64-sample signal → Haar coefficients{on('run') || on('compress') ? ` · keep ${Math.round(frac * 100)}% → error ${(err * 100).toFixed(1)}%` : ''}</text>

      {/* signal + reconstruction */}
      <text x={PX} y={SIGY - 8} className="hw-lbl">signal{showRecon ? ' (blue) + reconstruction (orange)' : ''}</text>
      <polyline points={SIG.map((v, i) => `${sxi(i).toFixed(1)},${sval(v).toFixed(1)}`).join(' ')} className="hw-sig" fill="none" />
      {showRecon && <polyline points={recon.map((v, i) => `${sxi(i).toFixed(1)},${sval(v).toFixed(1)}`).join(' ')} className="hw-recon" fill="none" />}

      {/* pair brackets for the split scene */}
      {on('split') && SIG.map((_, i) => i % 2 === 0 && i < 16 ? <g key={i}><circle cx={sxi(i)} cy={sval(SIG[i])} r="3" className="hw-dot" /><circle cx={sxi(i + 1)} cy={sval(SIG[i + 1])} r="3" className="hw-dot" /><line x1={sxi(i)} y1={SIGY + SIGH + 6} x2={sxi(i + 1)} y2={SIGY + SIGH + 6} className="hw-pair" /></g> : null)}

      {/* coefficient bars */}
      <text x={PX} y={COY - 12} className="hw-lbl">{N} coefficients — 1 approximation + details by scale (coarse → fine){on('compress') || on('run') ? ' · kept bright, dropped faint' : ''}</text>
      <line x1={PX} y1={COY + COH / 2} x2={PX + 760} y2={COY + COH / 2} className="hw-axis" />
      {COEF.map((v, i) => { const h = (Math.abs(v) / maxC) * (COH / 2); const lvl = levelOf(i); const drop = (on('compress') || on('run')) && !mask[i];
        return <rect key={i} x={PX + (i / N) * 760} y={v >= 0 ? COY + COH / 2 - h : COY + COH / 2} width={Math.max(1, 760 / N - 0.6)} height={h} className={`hw-coef ${drop ? 'drop' : ''}`} style={{ fill: `hsl(${HUE[Math.min(lvl, HUE.length - 1)]} ${lvl === 0 ? 85 : 60}% ${drop ? '30%' : '58%'} / ${drop ? 0.35 : 1})` }} />; })}
      <text x={PX} y={COY + COH + 16} className="hw-scale">approx</text>
      <text x={PX + 760} y={COY + COH + 16} className="hw-scale" textAnchor="end">finest details (near-zero where smooth)</text>

      <text x="450" y="400" className="hw-foot" textAnchor="middle">
        {on('split') ? 'each pair → average (trend) + difference (detail): same info, split'
          : on('pyramid') ? 'recurse on the averages → details at every scale, localized in time'
          : on('perfect') ? 'orthonormal → inverse rebuilds the signal exactly (energy preserved)'
          : on('compact') ? 'smooth regions → near-zero details; energy packs into a few coeffs'
          : on('compress') ? 'keep the large coeffs, drop the rest → compression + denoising'
          : `${Math.round(frac * 100)}% of coeffs → ${(err * 100).toFixed(1)}% error (raw samples: ${(rawErr * 100).toFixed(0)}%)`}
      </text>
    </svg>
  );
}
