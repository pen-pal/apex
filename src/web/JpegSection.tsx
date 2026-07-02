// Guided story #16: how JPEG compresses an image — the discrete cosine transform + quantization, on the GuidedStory
// engine. JPEG is lossy: it shrinks a photo ~10× by discarding fine detail the eye barely notices, working in
// frequency instead of pixels. Scenes: the lossy idea, 8×8 blocks, DCT (pixels → frequencies), quantization (the
// lossy step — divide and round, zeroing the high frequencies), encode/decode, then a live quality slider that
// zeroes coefficients and rebuilds a blockier block. Real 8×8 DCT/IDCT and the standard luminance quant table.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const Q = [[16, 11, 10, 16, 24, 40, 51, 61], [12, 12, 14, 19, 26, 58, 60, 55], [14, 13, 16, 24, 40, 57, 69, 56], [14, 17, 22, 29, 51, 87, 80, 62], [18, 22, 37, 56, 68, 109, 103, 77], [24, 35, 55, 64, 81, 104, 113, 92], [49, 64, 78, 87, 103, 121, 120, 101], [72, 92, 95, 98, 112, 100, 103, 99]];
const Cc = (u: number) => u === 0 ? Math.SQRT1_2 : 1;
const dct2 = (f: number[][]) => { const F = Array.from({ length: 8 }, () => Array(8).fill(0)); for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) { let s = 0; for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) s += f[x][y] * Math.cos((2 * x + 1) * u * Math.PI / 16) * Math.cos((2 * y + 1) * v * Math.PI / 16); F[u][v] = 0.25 * Cc(u) * Cc(v) * s; } return F; };
const idct2 = (F: number[][]) => { const f = Array.from({ length: 8 }, () => Array(8).fill(0)); for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { let s = 0; for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) s += Cc(u) * Cc(v) * F[u][v] * Math.cos((2 * x + 1) * u * Math.PI / 16) * Math.cos((2 * y + 1) * v * Math.PI / 16); f[x][y] = 0.25 * s; } return f; };
const qscale = (quality: number) => quality >= 50 ? 200 - 2 * quality : 5000 / quality;
const scaledQ = (u: number, v: number, quality: number) => Math.max(1, Math.floor((Q[u][v] * qscale(quality) + 50) / 100));

// a sample 8×8 luminance block: a diagonal gradient with an edge — smooth areas + a high-frequency step
const BLOCK: number[][] = Array.from({ length: 8 }, (_, x) => Array.from({ length: 8 }, (_, y) => Math.max(0, Math.min(255, 24 * (x + y) + (y >= 5 ? 70 : 0)))));

function compress(quality: number) {
  const F = dct2(BLOCK);
  const quant = F.map((row, u) => row.map((c, v) => Math.round(c / scaledQ(u, v, quality))));
  const deq = quant.map((row, u) => row.map((c, v) => c * scaledQ(u, v, quality)));
  const recon = idct2(deq).map((row) => row.map((v) => Math.max(0, Math.min(255, Math.round(v)))));
  const nz = quant.flat().filter((x) => x !== 0).length;
  return { F, quant, recon, nz };
}

type Phase = 'lossy' | 'blocks' | 'dct' | 'quant' | 'encode' | 'run';

export function JpegSection() {
  const [quality, setQuality] = useState(50);
  const live = compress(quality);

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Img phase={key} quality={key === 'quant' || key === 'encode' ? 30 : 90} /> });

  const scenes: StoryScene[] = [
    narrated('lossy', 'Throw away what the eye won’t miss', 'A photo is millions of pixels. JPEG shrinks it about ten to one — and it is lossy: it deliberately discards detail your eye barely notices. What makes that possible is to stop thinking in pixels and start thinking in frequencies.'),
    narrated('blocks', 'Work in 8×8 blocks', 'The image is chopped into 8×8-pixel blocks, each compressed on its own. (Colour is split into brightness and two colour channels, and the colour is subsampled first, because eyes see brightness detail far better than colour.) Here is one block.'),
    narrated('dct', 'DCT — pixels to frequencies', 'The discrete cosine transform rewrites the 64 pixels as 64 frequency coefficients. Top-left is the block’s average brightness; moving right and down is finer and finer detail. For a typical block almost all the energy lands in the top-left few — the low frequencies.'),
    narrated('quant', 'Quantize — the lossy step', 'Now divide each coefficient by a value from a quantization table and round. The table uses big divisors for high frequencies, so those fine-detail coefficients round to zero — and that is exactly the information the eye won’t miss. All the loss, and most of the compression, happens right here.'),
    narrated('encode', 'Encode, then decode', 'The block is now mostly zeros, which pack down to almost nothing (a zigzag scan, run-lengths, then Huffman coding — the Huffman section). To view it, the decoder reverses everything: dequantize, inverse-DCT, back to pixels — close to the original, but not identical.'),
    { key: 'run', title: 'Slide the quality', caption: 'Drop the quality and watch high-frequency coefficients vanish to zero and the rebuilt block turn blocky and ringed near the edge. Fewer non-zero coefficients means a smaller file — the whole size-versus-quality trade in one slider.', render: () => <Img phase="run" quality={quality} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="jpg-lbl">quality: {quality}<input type="range" min={2} max={95} value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></label>
          <span className="jpg-live">{live.nz} / 64 non-zero coefficients</span>
        </>
      )}
    />
  );
}

const gray = (v: number) => `rgb(${v},${v},${v})`;
function Grid({ x, y, cells, mode }: { x: number; y: number; cells: number[][]; mode: 'gray' | 'coef' }) {
  const cs = 20;
  const max = mode === 'coef' ? Math.max(1, ...cells.flat().map((c) => Math.abs(c))) : 255;
  return <g>{cells.map((row, r) => row.map((c, col) => {
    const fill = mode === 'gray' ? gray(c) : c === 0 ? '#141a24' : `hsl(${c > 0 ? 200 : 30} 70% ${25 + 45 * Math.min(1, Math.abs(c) / max)}%)`;
    return <rect key={`${r}-${col}`} x={x + col * cs} y={y + r * cs} width={cs - 0.5} height={cs - 0.5} fill={fill} className="jpg-cell" />;
  }))}</g>;
}

function Img({ phase, quality }: { phase: Phase; quality: number }) {
  const on = (p: Phase) => phase === p;
  const { F, quant, recon, nz } = compress(quality);
  const showDct = on('dct') || on('quant') || on('encode') || on('run');
  const showQuant = on('quant') || on('encode') || on('run');
  const showRecon = on('encode') || on('run');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {on('lossy') && <>
        <text x="450" y="200" className="jpg-mid" textAnchor="middle">pixels → frequencies → drop the ones you won’t miss</text>
        <text x="450" y="250" className="jpg-mid dim" textAnchor="middle">lossy: the decoded image is close to the original, never identical</text>
      </>}
      {!on('lossy') && <>
        {/* original block */}
        <text x="130" y="150" className="jpg-cap" textAnchor="middle">8×8 block (pixels)</text>
        <Grid x={50} y={160} cells={BLOCK} mode="gray" />
        {/* DCT coeffs */}
        {showDct && <>
          <text x="360" y="150" className="jpg-arrow" textAnchor="middle">→ DCT →</text>
          <text x="450" y="150" className="jpg-cap" textAnchor="middle">frequencies</text>
          <Grid x={370} y={160} cells={showQuant ? quant : F.map((r) => r.map((c) => Math.round(c)))} mode="coef" />
          {showQuant && <text x="450" y="342" className="jpg-note" textAnchor="middle">{nz} non-zero — the rest rounded to 0</text>}
        </>}
        {/* reconstruction */}
        {showRecon && <>
          <text x="690" y="150" className="jpg-arrow" textAnchor="middle">→ IDCT →</text>
          <text x="770" y="150" className="jpg-cap" textAnchor="middle">rebuilt</text>
          <Grid x={690} y={160} cells={recon} mode="gray" />
        </>}
      </>}
      <text x="450" y="452" className="jpg-foot" textAnchor="middle">
        {on('lossy') ? 'compression by discarding detail below what the eye resolves'
          : on('blocks') ? 'each 8×8 block is transformed and quantized independently'
          : on('dct') ? 'low frequencies (top-left) hold most of the block’s energy'
          : on('quant') ? 'big divisors on high frequencies send fine detail to zero — that is the loss'
          : on('encode') ? 'mostly-zero blocks compress hugely; decoding inverts the steps'
          : `${nz} non-zero coefficients — lower quality zeroes more and blocks up the image`}
      </text>
    </svg>
  );
}
