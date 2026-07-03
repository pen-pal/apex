// Guided story: how video inter-frame compression works (H.264-style motion compensation). Consecutive frames are
// nearly identical, so instead of coding each frame whole (like a JPEG), a P-frame predicts this frame from the
// previous one: block matching finds each block's motion vector (the offset to its best match in the reference), and
// only the tiny leftover residual is coded (DCT+quantize, like JPEG). Real block-matching motion estimation (verified:
// a pan recovers the exact motion vectors, residual near-zero except at the frame edges); canvas-rendered frames. Complements JPEG (spatial → temporal).
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const W = 48, H = 32, B = 8, S = 7; // frame, block, search range
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const tex = (x: number, y: number) => clamp(128 + 80 * Math.sin(x * 0.5) * Math.cos(y * 0.45) + 45 * Math.sin((x + y) * 0.28));
type Frame = number[]; // length W*H
// edge extension (clamp to the nearest edge pixel) — what real codecs do for motion vectors that point off-frame
const at = (f: Frame, x: number, y: number) => f[(y < 0 ? 0 : y >= H ? H - 1 : y) * W + (x < 0 ? 0 : x >= W ? W - 1 : x)];

function makeFrame(dx: number, dy: number, newObj: boolean): Frame {
  const f: Frame = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = tex(x - dx, y - dy);
    if (newObj && x >= 34 && x < 42 && y >= 6 && y < 14) v = 245; // a bright block that isn't in the reference
    f[y * W + x] = v;
  }
  return f;
}

type MV = { bx: number; by: number; mx: number; my: number };
function motionEstimate(ref: Frame, cur: Frame): { mvs: MV[]; residual: Frame; nonzero: number; spike: boolean } {
  const mvs: MV[] = []; const residual: Frame = new Array(W * H).fill(0); let nonzero = 0, maxBlock = 0;
  for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B) {
    let best = Infinity, bmx = 0, bmy = 0;
    for (let my = -S; my <= S; my++) for (let mx = -S; mx <= S; mx++) {
      let sad = 0;
      for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) sad += Math.abs(cur[(by + y) * W + bx + x] - at(ref, bx + x + mx, by + y + my));
      const mag = mx * mx + my * my;
      if (sad < best - 1e-6 || (Math.abs(sad - best) < 1e-6 && mag < bmx * bmx + bmy * bmy)) { best = sad; bmx = mx; bmy = my; }
    }
    mvs.push({ bx, by, mx: bmx, my: bmy });
    let blockRes = 0;
    for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
      const r = cur[(by + y) * W + bx + x] - at(ref, bx + x + bmx, by + y + bmy);
      residual[(by + y) * W + bx + x] = r;
      if (Math.abs(r) > 6) nonzero++;
      blockRes += Math.abs(r);
    }
    if (blockRes > maxBlock) maxBlock = blockRes;
  }
  return { mvs, residual, nonzero, spike: maxBlock > 3000 }; // one block with no good match = new content / cut
}

function toURL(pix: (i: number) => [number, number, number]): string {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!; const img = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const [r, g, b] = pix(i); img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return cv.toDataURL();
}

type Phase = 'repeat' | 'predict' | 'motion' | 'residual' | 'payoff' | 'run';

export function MotionCompSection() {
  const [dx, setDx] = useState(4);
  const [dy, setDy] = useState(2);
  const [newObj, setNewObj] = useState(false);

  const model = useMemo(() => {
    const ref = makeFrame(0, 0, false);
    const cur = makeFrame(dx, dy, newObj);
    const { mvs, residual, nonzero, spike } = motionEstimate(ref, cur);
    const refURL = toURL((i) => { const v = ref[i]; return [v, v, v]; });
    const curURL = toURL((i) => { const v = cur[i]; return [v, v, v]; });
    const resURL = toURL((i) => { const r = residual[i]; const v = clamp(128 + r * 2.5); return Math.abs(r) > 6 ? [clamp(128 + r * 4), 60, 60] : [v, v, v]; });
    const full = W * H;                 // raw bytes (illustrative)
    const pframe = mvs.length * 2 + nonzero; // 2 bytes per motion vector + residual bytes
    return { mvs, refURL, curURL, resURL, full, pframe, nonzero, spike };
  }, [dx, dy, newObj]);

  const still = useMemo(() => {
    const ref = makeFrame(0, 0, false), cur = makeFrame(4, 2, false);
    const { mvs, residual, nonzero, spike } = motionEstimate(ref, cur);
    return { mvs, refURL: toURL((i) => { const v = ref[i]; return [v, v, v]; }), curURL: toURL((i) => { const v = cur[i]; return [v, v, v]; }),
      resURL: toURL((i) => { const r = residual[i]; const v = clamp(128 + r * 2.5); return Math.abs(r) > 6 ? [clamp(128 + r * 4), 60, 60] : [v, v, v]; }),
      full: W * H, pframe: mvs.length * 2 + nonzero, nonzero, spike };
  }, []);

  const scenes: StoryScene[] = [
    { key: 'repeat', title: 'Video is mostly repetition', caption: 'Two consecutive frames of video are almost identical — the background sits still and only parts move. Coding each frame whole, like a separate JPEG, stores the unchanged background over and over. Inter-frame coding stores only what changed.', render: () => <MC phase="repeat" m={still} dx={4} dy={2} /> },
    { key: 'predict', title: 'Predict this frame from the last', caption: 'So a P-frame doesn’t encode pixels — it predicts them from the previous frame (the reference). If nothing had moved, the previous frame would be a perfect prediction and you’d store nothing at all. Things do move, so you need to say how.', render: () => <MC phase="predict" m={still} dx={4} dy={2} /> },
    { key: 'motion', title: 'Motion vectors: where each block went', caption: 'Split the frame into blocks. For each one, search the previous frame for the patch that best matches it — minimizing the summed pixel difference — and record just the offset: a motion vector. A P-frame is mostly a grid of these little arrows.', render: () => <MC phase="motion" m={still} dx={4} dy={2} /> },
    { key: 'residual', title: 'The residual fixes the rest', caption: 'Shift the reference by every motion vector and you get a motion-compensated prediction. Subtract it from the real frame; the leftover residual is tiny and mostly zero (grey here). That residual is DCT-transformed and quantized exactly like a JPEG block — but there’s almost nothing left to code.', render: () => <MC phase="residual" m={still} dx={4} dy={2} /> },
    { key: 'payoff', title: 'A fraction of a full frame', caption: 'So a P-frame costs a grid of motion vectors plus a mostly-empty residual — a fraction of a full frame (for a large, mostly-static scene, as little as 1–2%; this tiny toy shows more because its edges are a big share of it). That’s why an hour of video fits where a few hundred raw frames wouldn’t. It breaks on scene cuts and new objects: no block matches, the residual explodes, and the encoder codes a fresh full I-frame instead.', render: () => <MC phase="payoff" m={still} dx={4} dy={2} /> },
    { key: 'run', title: 'Pan the camera, add an object', caption: 'Pan the frame and watch the motion vectors all point the same way while the residual stays near-zero and the P-frame size stays tiny. Then drop in a new object with no match in the previous frame — its block’s residual spikes red and the size jumps. That spike is when the encoder reaches for an I-frame.', render: () => <MC phase="run" m={model} dx={dx} dy={dy} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Consecutive video frames are almost identical — the background sits still and only parts move. Coding every frame in full (like a JPEG each) is enormously wasteful. Inter-frame coding predicts this frame from the previous one: for each block it searches the previous frame for the patch that best matches and records only the offset — a <strong>motion vector</strong> — plus the small leftover error. A P-frame is mostly motion vectors, a fraction of a full frame.</>,
        takeaway: <>Motion estimation is <strong>block matching</strong>: slide each block of the current frame over a search window in the reference frame and keep the offset with the smallest pixel difference (SAD). That offset is the motion vector; shifting the reference by all the vectors gives a motion-compensated prediction. Subtract it and the <strong>residual</strong> is tiny and mostly zero — DCT-transformed and quantized just like a JPEG block, but with almost nothing left to code. So a P-frame costs a grid of motion vectors plus a mostly-empty residual — a small fraction of a full frame, as little as 1–2% for a large, mostly-static scene, which is why an hour of video fits where a few hundred raw frames wouldn’t. It breaks at scene cuts and new objects: no block matches, the residual explodes, and the encoder gives up and codes a fresh I-frame. (This is the temporal counterpart to JPEG’s spatial compression.)</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="icf-ctl">pan x<input type="range" min={-6} max={6} value={dx} onChange={(e) => setDx(+e.target.value)} /></label>
          <label className="icf-ctl">pan y<input type="range" min={-6} max={6} value={dy} onChange={(e) => setDy(+e.target.value)} /></label>
          <label className="icf-ctl"><input type="checkbox" checked={newObj} onChange={(e) => setNewObj(e.target.checked)} /> new object</label>
          <span className="icf-live">P-frame ≈ {model.pframe} B vs {model.full} B full ({(100 * model.pframe / model.full).toFixed(0)}%)</span>
        </>
      )}
    />
  );
}

function MC({ phase, m, dx, dy }: { phase: Phase; m: { mvs: MV[]; refURL: string; curURL: string; resURL: string; full: number; pframe: number; nonzero: number; spike: boolean }; dx: number; dy: number }) {
  const on = (p: Phase) => phase === p;
  const showMV = on('motion') || on('run');
  const showRes = on('residual') || on('payoff') || on('run');
  // three frame panels at ~230px wide, scaled from W×H
  const panel = (x: number, url: string, label: string, hot: boolean) => (
    <g>
      <image href={url} x={x} y={70} width={230} height={230 * H / W} className="icf-img" preserveAspectRatio="none" />
      <rect x={x} y={70} width={230} height={230 * H / W} rx="4" className={`icf-frame ${hot ? 'hot' : ''}`} />
      <text x={x + 115} y={62} className="icf-lbl" textAnchor="middle">{label}</text>
    </g>
  );
  const sx = 230 / W, sy = (230 * H / W) / H;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {panel(40, m.refURL, 'previous frame (reference)', on('predict'))}
      {panel(330, m.curURL, 'this frame', on('repeat') || on('motion') || on('run'))}
      {showRes ? panel(620, m.resURL, 'residual (red = leftover)', on('residual'))
        : <>
          <rect x={620} y={70} width={230} height={230 * H / W} rx="4" className="icf-frame ghost" />
          <text x={735} y={70 + 115 * H / W} className="icf-ghost" textAnchor="middle">{on('payoff') ? 'residual ≈ empty' : ''}</text>
        </>}

      {/* motion vectors on the current frame */}
      {showMV && m.mvs.map((v, i) => {
        const cx = 330 + (v.bx + B / 2) * sx, cy = 70 + (v.by + B / 2) * sy;
        const big = Math.abs(v.mx) + Math.abs(v.my) > 0.5;
        return big ? <line key={i} x1={cx} y1={cy} x2={cx - v.mx * sx * 1.6} y2={cy - v.my * sy * 1.6} className="icf-mv" markerEnd="url(#icf-arr)" /> : <circle key={i} cx={cx} cy={cy} r="2" className="icf-mv0" />;
      })}

      {/* cost bars */}
      {(on('payoff') || on('run')) && (
        <g>
          <text x={450} y={300} className="icf-costlbl" textAnchor="middle">bytes to store this frame</text>
          <rect x={230} y={316} width={440} height={22} rx="4" className="icf-bar full" />
          <text x={230} y={332} className="icf-bartxt" dx="8">full frame: {m.full} B</text>
          <rect x={230} y={344} width={Math.max(8, 440 * m.pframe / m.full)} height={22} rx="4" className="icf-bar p" />
          <text x={230} y={360} className="icf-bartxt" dx="8">P-frame: {m.pframe} B  ({(100 * m.pframe / m.full).toFixed(0)}%)</text>
        </g>
      )}

      <text x={450} y={452} className="icf-foot" textAnchor="middle">
        {on('repeat') ? 'only what moved needs coding — the rest is already in the previous frame'
          : on('predict') ? 'the previous frame IS the prediction — motion vectors say how it shifted'
          : on('motion') ? `block matching → a motion vector per block (this pan: about ${-dx}, ${-dy})`
          : on('residual') ? 'grey = zero residual; only genuine changes cost bits'
          : on('payoff') ? 'motion vectors + a mostly-empty residual = a P-frame, a fraction of a full frame'
          : m.spike ? '⚠ a block with no good match (new object or cut) → the encoder codes a fresh I-frame' : 'panned: vectors track the motion, residual near-zero, P-frame tiny'}
      </text>
      <defs><marker id="icf-arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" className="icf-arrhead" /></marker></defs>
    </svg>
  );
}
