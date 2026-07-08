// Weight quantization, made visible. A row of weights on a number line with the quantization levels drawn in; slide the
// bit-width and watch each weight snap to the nearest level, the error grow, and the memory shrink. Toggle an outlier
// and watch the scale stretch so the levels spread and the small weights collapse toward zero. Model + tests in
// quantize.ts.
import { useMemo, useState } from 'react';
import { quantize } from './quantize';

const SMALL = [-0.92, -0.61, -0.34, -0.12, -0.03, 0.08, 0.19, 0.31, 0.44, 0.66, 0.83];
const OUTLIER = 6.0;
const W = 640, H = 150, PAD = 24, AXIS = 96;

export function QuantizeSection() {
  const [bits, setBits] = useState(4);
  const [outlier, setOutlier] = useState(false);

  const weights = useMemo(() => (outlier ? [...SMALL, OUTLIER] : SMALL), [outlier]);
  const q = useMemo(() => quantize(weights, bits), [weights, bits]);
  const absMax = Math.max(...weights.map((w) => Math.abs(w)));
  const x = (v: number) => W / 2 + (v / absMax) * (W / 2 - PAD);
  const qmax = Math.pow(2, bits - 1) - 1;
  const ticks: number[] = [];
  for (let level = -qmax - 1; level <= qmax; level++) ticks.push(level * q.scale);
  const drawTicks = q.levels <= 40;

  return (
    <div className="qz">
      <div className="qz-controls">
        <label className="qz-slider"><span>precision&nbsp;<b>{bits}-bit</b>&nbsp;<code>({q.levels} levels)</code></span>
          <input type="range" min={2} max={8} value={bits} onChange={(e) => setBits(+e.target.value)} /></label>
        <label className="qz-tog"><input type="checkbox" checked={outlier} onChange={(e) => setOutlier(e.target.checked)} /> add one outlier weight (6.0)</label>
      </div>

      <div className="qz-line">
        <div className="qz-lbl">weights (dots) snapped to the nearest level (ticks); red is the rounding error</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="qz-svg" role="img" aria-label="quantization number line">
          <line x1={PAD / 2} y1={AXIS} x2={W - PAD / 2} y2={AXIS} className="qz-axis" />
          {drawTicks && ticks.map((t, i) => <line key={i} x1={x(t)} y1={AXIS - 7} x2={x(t)} y2={AXIS + 7} className="qz-tick" />)}
          {!drawTicks && <text x={W / 2} y={AXIS + 26} textAnchor="middle" className="qz-fine">{q.levels} levels — too fine to draw (near-continuous)</text>}
          {weights.map((w, i) => {
            if (Math.abs(w) > 1.2 && outlier) { // the outlier itself, pinned at the edge with a label
              return <g key={i}><circle cx={x(w)} cy={AXIS} r={5} className="qz-outlier" /><text x={x(w)} y={AXIS - 14} textAnchor="middle" className="qz-outlbl">outlier</text></g>;
            }
            const err = Math.abs(w - q.dequant[i]);
            return (
              <g key={i}>
                <line x1={x(w)} y1={AXIS - 34} x2={x(q.dequant[i])} y2={AXIS} className={`qz-err ${err > q.step * 0.6 ? 'qz-err-big' : ''}`} />
                <circle cx={x(w)} cy={AXIS - 34} r={4} className="qz-w" />
                <circle cx={x(q.dequant[i])} cy={AXIS} r={3} className="qz-snap" />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="qz-stats">
        <div className="qz-stat"><b>{q.memPct}%</b><span>of fp16 size</span></div>
        <div className="qz-stat"><b>{q.levels}</b><span>levels</span></div>
        <div className="qz-stat qz-hi"><b>{q.rmse.toFixed(3)}</b><span>RMSE (rounding error)</span></div>
      </div>

      <div className={`qz-verdict ${outlier ? 'qz-bad' : q.rmse < 0.04 ? 'qz-good' : 'qz-ok'}`}>
        {outlier
          ? <>The single outlier at 6.0 sets the scale for everyone, so the {q.levels} levels spread across ±6 and the small weights land on just a couple of coarse steps near zero — RMSE jumps to <b>{q.rmse.toFixed(3)}</b> though almost every weight barely changed. This is why low-bit LLM quantization keeps outliers in higher precision (LLM.int8, GPTQ, AWQ).</>
          : <>{bits}-bit stores the weights at <b>{q.memPct}%</b> of fp16 with RMSE <b>{q.rmse.toFixed(3)}</b>. {bits >= 4 ? 'Small enough error to be nearly free — this is why 4-bit lets a 70B model fit on one consumer GPU.' : 'Below 4 bits the steps get coarse and the error climbs fast — the model starts to degrade.'}</>}
      </div>

      <p className="qz-foot">
        A weight trained in fp16 doesn’t need 16 bits to be <em>useful</em> — quantization maps a whole group to a few
        integer levels around a shared <strong>scale</strong>, storing the small integers and multiplying back at use
        time. int8 halves the memory, <strong>int4 quarters it</strong>, and since inference is memory-bandwidth-bound,
        smaller weights also mean faster tokens. The error is just rounding — until an <strong>outlier</strong> hijacks
        the scale, spreading the levels so thin that the ordinary weights collapse toward zero. That’s the whole research
        story of LLM quantization: keep the rare large activations/weights in high precision (mixed-precision, per-group
        scales, or learned rounding) so the common ones keep their bits. (LLM.int8, GPTQ, AWQ, QLoRA.)
      </p>
    </div>
  );
}
