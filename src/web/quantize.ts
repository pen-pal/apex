// Weight quantization — how a model trained in fp16 is stored and served at lower precision so it fits (and runs faster)
// on smaller hardware. Symmetric quantization picks a single scale for a tensor, maps every weight to the nearest of
// 2^bits signed integer levels, and stores the small integers; at use time it multiplies back by the scale. int4 is a
// quarter the size of fp16. The cost is rounding error, and the sharp edge is OUTLIERS: one large-magnitude weight sets
// the scale for the whole group, so the many small weights land on only a few coarse levels near zero and lose almost
// all their precision — the reason naive low-bit quantization hurts and methods like LLM.int8()/GPTQ/AWQ treat outliers
// specially. This models symmetric quantization and its error.

export interface Quant { levels: number; scale: number; step: number; dequant: number[]; rmse: number; maxErr: number; memPct: number }

export function quantize(weights: number[], bits: number): Quant {
  const qmax = Math.pow(2, bits - 1) - 1;            // signed range is [-qmax-1, qmax]
  const absMax = Math.max(...weights.map((w) => Math.abs(w)), 1e-9);
  const scale = absMax / qmax;                        // one large weight sets this for everyone
  const dequant = weights.map((w) => Math.max(-qmax - 1, Math.min(qmax, Math.round(w / scale))) * scale);
  const errs = weights.map((w, i) => w - dequant[i]);
  const rmse = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / weights.length);
  const maxErr = Math.max(...errs.map(Math.abs));
  return {
    levels: Math.pow(2, bits),
    scale,
    step: scale,                                      // spacing between adjacent representable values
    dequant,
    rmse,
    maxErr,
    memPct: Math.round((bits / 16) * 100),            // vs fp16
  };
}
