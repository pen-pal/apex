// Guided story: how dithering shows a grayscale photo with only black and white pixels (Floyd-Steinberg error
// diffusion). Naive thresholding collapses a gradient into flat bands; dithering keeps the tone by spreading each
// pixel's rounding error onto its not-yet-drawn neighbours, so a patch of black/white pixels averages back to the
// original gray. Real FS algorithm on a canvas (verified in node: it preserves average brightness). A fresh image
// angle distinct from JPEG (which drops frequency detail; this trades spatial resolution for tone). Sandboxed.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const W = 132, H = 88;
// a smooth continuous-tone grayscale scene: a lit sphere over a floor gradient
function scene(x: number, y: number): number {
  const floor = 26 + 150 * (y / H);
  const cx = W * 0.5, cy = H * 0.42, R = 34;
  const d = Math.hypot(x - cx, (y - cy) * 1.05);
  const sphere = d < R ? 235 * Math.pow(Math.max(0, 1 - (d / R) * (d / R)), 0.6) : 0;
  return Math.max(0, Math.min(255, Math.max(floor, sphere)));
}
const GRAY: number[] = Array.from({ length: W * H }, (_, i) => scene(i % W, Math.floor(i / W)));

const threshold = (g: number[]) => g.map((v) => (v < 128 ? 0 : 255));
function floyd(g: number[]): number[] {
  const buf = g.slice(), out = new Array(W * H);
  const add = (x: number, y: number, e: number, f: number) => { if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] += (e * f) / 16; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const old = buf[y * W + x], nw = old < 128 ? 0 : 255; out[y * W + x] = nw; const err = old - nw;
    add(x + 1, y, err, 7); add(x - 1, y + 1, err, 3); add(x, y + 1, err, 5); add(x + 1, y + 1, err, 1);
  }
  return out;
}
function toURL(pix: number[]): string {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d')!; const img = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const v = pix[i]; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return cv.toDataURL();
}

type Mode = 'orig' | 'thresh' | 'fs';
type Phase = 'onebit' | 'naive' | 'spread' | 'weights' | 'eye' | 'run';

export function DitherSection() {
  const [mode, setMode] = useState<Mode>('fs');
  const urls = useMemo(() => ({ orig: toURL(GRAY), thresh: toURL(threshold(GRAY)), fs: toURL(floyd(GRAY)) }), []);

  const scene2 = (key: Exclude<Phase, 'run'>, title: string, caption: string, m: Mode): StoryScene =>
    ({ key, title, caption, render: () => <Dith phase={key} urls={urls} mode={m} /> });

  const scenes: StoryScene[] = [
    scene2('onebit', 'One bit per pixel', 'Plenty of displays can only draw black or white — one bit per pixel: e-ink readers, thermal receipt printers, old LCDs, newsprint. So how do you show a smooth grayscale photo, where each pixel wants one of 256 shades, using only two?', 'orig'),
    scene2('naive', 'Rounding to the nearest fails', 'The obvious move: round each pixel to whichever is closer, black or white, at a threshold of 128. But a smooth gradient collapses into two flat bands — every shade of tone is gone. The rounding error you threw away (up to 127 per pixel) is simply lost.', 'thresh'),
    scene2('spread', 'Don’t discard the error — spread it', 'The fix is to keep that error instead of discarding it. Round the pixel, then push its leftover error onto the neighbours you haven’t drawn yet. Force a mid-gray pixel to black and you’ve made it 100 too dark, so nudge the pixels to its right and below 100 brighter to compensate. The error is conserved.', 'fs'),
    scene2('weights', 'Floyd–Steinberg’s weights', 'Floyd–Steinberg spreads each pixel’s error to four not-yet-drawn neighbours with fixed fractions: 7/16 to the right, and 3/16, 5/16, 1/16 across the row below. Over any small patch, the black and white pixels it lays down average out to exactly the original gray.', 'fs'),
    scene2('eye', 'Your eye does the rest', 'From a normal viewing distance your eye blurs the dots together and reads continuous gray — the same tone as the original, built entirely from black and white. It’s how newspapers printed photographs for a century and how an e-ink screen shows one today: lossy in every pixel, faithful in the average.', 'fs'),
    { key: 'run', title: 'Threshold vs dithering', caption: 'Flip between plain thresholding and Floyd–Steinberg dithering on the same image. Thresholding bands the gradient and flattens the sphere; dithering rebuilds every tone from a spray of black and white dots. Zoom in (right) and it’s clearly just two colours; step back and it’s a photo.', render: () => <Dith phase="run" urls={urls} mode={mode} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Some displays can only show black or white — one bit per pixel: e-ink, thermal receipt printers, old LCDs, and newsprint. To show a grayscale photo on them you can’t just round each pixel to the nearer of black or white — a smooth gradient collapses into flat bands and all the tone vanishes. Dithering keeps the tone by <em>not throwing the rounding error away</em>: it spreads each pixel’s error onto its neighbours, so a patch of black and white pixels averages back to the original gray.</>,
        takeaway: <>Floyd–Steinberg walks the image pixel by pixel: round each to black or white, then push the leftover error (the true value minus what you drew) onto the not-yet-drawn neighbours with fixed weights — <strong>7/16</strong> to the right, and <strong>3/16, 5/16, 1/16</strong> across the row below. So if a pixel was mid-gray and you forced it black, its neighbours get nudged toward white to compensate, and over any small region the count of black and white pixels reproduces the original brightness (verified: the dithered average matches the input to within a point). Your eye, blurring the dots at normal distance, sees continuous gray. It is lossy per pixel but faithful in average — which is why a century of newspaper photos, every e-ink screen, and every receipt printer use it, and why the same idea (spread the quantization error instead of discarding it) reappears as noise-shaping in audio converters.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" className={`dth-btn ${mode === 'thresh' ? 'on' : ''}`} onClick={() => setMode('thresh')}>threshold</button>
          <button type="button" className={`dth-btn ${mode === 'fs' ? 'on' : ''}`} onClick={() => setMode('fs')}>Floyd–Steinberg</button>
          <span className="dth-live">{mode === 'thresh' ? 'plain threshold — the gradient bands, tone is lost' : 'error diffusion — every tone rebuilt from black + white dots'}</span>
        </>
      )}
    />
  );
}

function Dith({ phase, urls, mode }: { phase: Phase; urls: { orig: string; thresh: string; fs: string }; mode: Mode }) {
  const on = (p: Phase) => phase === p;
  const rightURL = mode === 'orig' ? urls.orig : mode === 'thresh' ? urls.thresh : urls.fs;
  const rightLbl = mode === 'orig' ? 'grayscale (256 shades)' : mode === 'thresh' ? 'threshold — 1 bit, banded' : 'Floyd–Steinberg — 1 bit, dithered';
  const showBoth = !on('weights');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {showBoth && <>
        <text x="230" y="52" className="dth-lbl" textAnchor="middle">original</text>
        <image href={urls.orig} x="60" y="64" width="340" height={340 * H / W} className="dth-img" preserveAspectRatio="none" />
        <rect x="60" y="64" width="340" height={340 * H / W} className="dth-frame" />
        <text x="670" y="52" className="dth-lbl" textAnchor="middle">{rightLbl}</text>
        <image href={rightURL} x="500" y="64" width="340" height={340 * H / W} className="dth-img" preserveAspectRatio="none" />
        <rect x="500" y="64" width="340" height={340 * H / W} className="dth-frame" />
        {/* zoom inset on the right image (nested svg viewBox crops a region), showing the dots */}
        {(on('eye') || on('run')) && mode !== 'orig' && <>
          <svg x="700" y="250" width="150" height="150" viewBox={`${W * 0.42} ${H * 0.30} ${W * 0.16} ${H * 0.16}`} preserveAspectRatio="none">
            <image href={rightURL} x="0" y="0" width={W} height={H} className="dth-img" preserveAspectRatio="none" />
          </svg>
          <rect x="700" y="250" width="150" height="150" className="dth-zoomframe" />
          <text x="775" y="418" className="dth-zoomlbl" textAnchor="middle">zoom: just 2 colours</text>
        </>}
      </>}

      {on('weights') && (
        <g>
          <text x="450" y="90" className="dth-lbl" textAnchor="middle">the error from each pixel spreads to 4 neighbours</text>
          {[['X', 380, 170, 'cur'], ['7/16', 470, 170, 'w'], ['3/16', 290, 250, 'w'], ['5/16', 380, 250, 'w'], ['1/16', 470, 250, 'w']].map(([t, x, y, c], i) => (
            <g key={i}>
              <rect x={x as number} y={y as number} width="80" height="60" rx="6" className={`dth-kern ${c}`} />
              <text x={(x as number) + 40} y={(y as number) + 37} className="dth-kernt" textAnchor="middle">{t as string}</text>
            </g>
          ))}
          <text x="450" y="356" className="dth-note" textAnchor="middle">the current pixel (X) is drawn; its error is pushed right and down (to undrawn pixels)</text>
        </g>
      )}

      <text x="450" y="452" className="dth-foot" textAnchor="middle">
        {on('onebit') ? '256 shades per pixel → only 2 available: black or white'
          : on('naive') ? 'threshold at 128 → the gradient becomes two flat bands, tone lost'
          : on('spread') ? 'push each pixel’s rounding error to its undrawn neighbours — nothing discarded'
          : on('weights') ? 'fixed fractions 7/16, 3/16, 5/16, 1/16 — the black/white dots average to the true gray'
          : on('eye') ? 'up close: black + white dots. from afar: continuous gray, same as the original'
          : mode === 'thresh' ? 'thresholding: banded, flat — the sphere and gradient are gone'
            : 'dithering: every tone rebuilt from a spray of two-colour dots'}
      </text>
    </svg>
  );
}
