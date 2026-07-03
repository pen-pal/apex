// Guided story: the biquad filter — the second-order IIR that is the unit cell of nearly all audio filtering (EQ bands,
// synth VCFs, tone controls, crossovers). One recursive formula with five coefficients and two samples of memory each way:
// y[n] = b0·x[n] + b1·x[n-1] + b2·x[n-2] − a1·y[n-1] − a2·y[n-2]. The coefficients place two zeros (frequencies pushed to
// silence) and two poles (frequencies boosted toward resonance); a pole near the unit circle makes a sharp peak (that's Q),
// and poles must stay INSIDE the circle or the feedback is unstable. Different coefficient sets give lowpass, highpass,
// bandpass, or notch (RBJ cookbook). Verified in node: the analytic |H(e^jω)| matches the DFT of the impulse response to
// 1e-15, the lowpass passes DC and blocks Nyquist, the poles are inside the unit circle, and higher Q gives a taller peak.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type BQ = { b0: number; b1: number; b2: number; a1: number; a2: number };
type FType = 'lp' | 'hp' | 'bp' | 'notch';
function coeffs(type: FType, f0: number, Q: number): BQ {
  const w0 = 2 * Math.PI * f0, c = Math.cos(w0), s = Math.sin(w0), al = s / (2 * Q), a0 = 1 + al;
  let b0 = 0, b1 = 0, b2 = 0;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
  else { b0 = 1; b1 = -2 * c; b2 = 1; } // notch
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * c / a0, a2: (1 - al) / a0 };
}
const Hmag = (bq: BQ, w: number): number => {
  const cr = Math.cos(w), ci = -Math.sin(w), c2r = Math.cos(2 * w), c2i = -Math.sin(2 * w);
  const nr = bq.b0 + bq.b1 * cr + bq.b2 * c2r, ni = bq.b1 * ci + bq.b2 * c2i;
  const dr = 1 + bq.a1 * cr + bq.a2 * c2r, di = bq.a1 * ci + bq.a2 * c2i;
  return Math.hypot(nr, ni) / Math.hypot(dr, di);
};
// poles = roots of z²+a1z+a2 ; return magnitude + a representative point
const poleMag = (bq: BQ): number => { const d = bq.a1 * bq.a1 - 4 * bq.a2; return d < 0 ? Math.sqrt(bq.a2) : Math.max(Math.abs((-bq.a1 + Math.sqrt(d)) / 2), Math.abs((-bq.a1 - Math.sqrt(d)) / 2)); };
const TYPES: { id: FType; label: string }[] = [{ id: 'lp', label: 'lowpass' }, { id: 'hp', label: 'highpass' }, { id: 'bp', label: 'bandpass' }, { id: 'notch', label: 'notch' }];

type Phase = 'formula' | 'response' | 'polezero' | 'resonance' | 'cascade' | 'run';
export function BiquadSection() {
  const [type, setType] = useState<FType>('lp'); const [f0, setF0] = useState(0.12); const [Q, setQ] = useState(2);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, t: FType, f: number, q: number): StoryScene =>
    ({ key, title, caption, render: () => <Filt phase={key} type={t} f0={f} Q={q} /> });

  const scenes: StoryScene[] = [
    scene('formula', 'A filter from five numbers', 'Most audio filtering — a synth’s warmth, an EQ band, a rumble cut — is one tiny recursive formula, the biquad: y[n] = b0·x[n] + b1·x[n−1] + b2·x[n−2] − a1·y[n−1] − a2·y[n−2]. Five coefficients and two samples of memory each way. Because its own past outputs feed back in (that’s the IIR part), a couple of taps can build a sharp, ringing resonance a plain moving average never could.', 'lp', 0.12, 0.707),
    scene('response', 'The frequency response', 'Feed in every frequency and measure how much comes out: the magnitude response |H(e^jω)|. One coefficient set keeps the lows and drops the highs (lowpass); others make a highpass, a bandpass, or a notch that removes one exact frequency (say 60 Hz hum). Same five-number structure, retuned, is every band on a graphic EQ. (Verified: the response computed from the coefficients matches the DFT of the impulse response to 1e-15.)', 'lp', 0.12, 0.707),
    scene('polezero', 'Poles and zeros', 'The coefficients place two zeros (frequencies pushed toward silence) and two poles (frequencies pulled toward resonance) on the complex plane, relative to the unit circle. A zero ON the circle makes a deep notch; a pole NEAR the circle makes a sharp peak. And the poles must stay strictly INSIDE the unit circle — a pole on or outside means the feedback grows without bound and the filter is unstable.', 'notch', 0.25, 4),
    scene('resonance', 'Resonance and Q', 'Slide the poles closer to the unit circle and the peak grows taller and narrower — that is the filter’s Q, its resonance. High Q rings like a struck bell (feedback almost, but not quite, oscillating); low Q is a gentle slope. Cutoff frequency sets WHERE the filter acts; Q sets HOW sharp. (Verified: Q of 0.7 → 2 → 8 gives peaks of 1.0 → 2.1 → 8.0.)', 'lp', 0.14, 8),
    scene('cascade', 'Cascade for steeper — and it’s everywhere', 'One biquad rolls off at 12 dB/octave. Chain several — each a “section” — for a steeper, brick-wall response, and doing it as cascaded biquads stays numerically stable where one big high-order filter would fall apart. The biquad is the unit of every parametric EQ, speaker crossover, synth filter, and DAW plugin. (Verified: the lowpass passes lows and blocks highs; poles stay inside the circle.)', 'lp', 0.12, 0.707),
    { key: 'run', title: 'Tune the filter', caption: 'Pick lowpass, highpass, bandpass, or notch and sweep the cutoff and Q. Watch the response curve reshape and the poles slide toward the unit circle as you raise Q — the peak sharpening into resonance. The pole magnitude stays under 1, so the filter stays stable no matter how you tune it.', render: () => <Filt phase="run" type={type} f0={f0} Q={Q} onType={setType} onF0={setF0} onQ={setQ} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A <strong>biquad</strong> is a second-order IIR filter — the unit cell of nearly all audio filtering. One recursive formula, <code>y[n] = b0·x[n] + b1·x[n−1] + b2·x[n−2] − a1·y[n−1] − a2·y[n−2]</code>, with five coefficients. They place two <strong>zeros</strong> (frequencies killed) and two <strong>poles</strong> (frequencies resonated) around the unit circle; a pole near the circle makes a sharp peak (that’s <strong>Q</strong>), and poles must stay <strong>inside</strong> it or it’s unstable. Retuning the coefficients gives a lowpass, highpass, bandpass, or notch — every EQ band is a biquad.</>,
        takeaway: <>The <strong>biquad</strong> (“bi-quadratic”) is a second-order recursive filter and the standard building block of digital audio EQ and synthesis. Its <strong>difference equation</strong> is <code>y[n] = b0 x[n] + b1 x[n−1] + b2 x[n−2] − a1 y[n−1] − a2 y[n−2]</code> (coefficients normalized so a0 = 1), and its <strong>transfer function</strong> is <code>H(z) = (b0 + b1 z⁻¹ + b2 z⁻²) / (1 + a1 z⁻¹ + a2 z⁻²)</code>. The numerator’s roots are the <strong>zeros</strong> and the denominator’s are the <strong>poles</strong>; evaluating H on the <strong>unit circle</strong> z = e^{'{'}jω{'}'} gives the <strong>frequency response</strong>, whose magnitude is what you hear as the filter’s shape (and which equals the DFT of the impulse response — verified here to 1e-15). Geometry drives sound: a pole at radius r and angle ω0 creates a resonant peak at frequency ω0 whose height and narrowness grow as r → 1 (this is <strong>Q</strong>, resonance / quality factor), while a zero on the circle forces the response to zero at that frequency (a perfect <strong>notch</strong>, e.g. to kill mains hum). <strong>Stability</strong> requires every pole strictly inside the unit circle (|pole| &lt; 1); a pole on or outside gives unbounded feedback. The <strong>RBJ Audio EQ Cookbook</strong> (Robert Bristow-Johnson) gives closed-form coefficients from three intuitive parameters — filter type, center/cutoff frequency f0, and Q (or bandwidth / shelf gain) — for <strong>lowpass, highpass, bandpass, notch, allpass, peaking, and shelving</strong> responses, which is why one structure covers every EQ band. A single biquad rolls off at <strong>12 dB/octave</strong> (second order); steeper filters are built by <strong>cascading</strong> biquad “sections” (a 6th-order filter = three biquads), which is far more numerically robust than one high-order direct form, especially in fixed point — hence standard forms like Direct Form I/II and the transposed variants that manage rounding and headroom. Biquads are everywhere audio is processed: parametric and graphic EQs, speaker crossovers, synthesizer voltage-controlled filters (the resonant sweep is Q near instability), de-essers, and the <code>BiquadFilterNode</code> in the Web Audio API. The same second-order section is the backbone of IIR filter design generally (Butterworth, Chebyshev, elliptic filters are realized as cascaded biquads).</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="biq-ctl">
          {TYPES.map((t) => <button key={t.id} type="button" className={`biq-btn ${type === t.id ? 'on' : ''}`} onClick={() => setType(t.id)}>{t.label}</button>)}
          <span className="biq-sep">|</span>
          <span className="biq-lab">cutoff</span>
          <button type="button" className="biq-btn" onClick={() => setF0((v) => Math.max(0.03, +(v - 0.02).toFixed(2)))}>−</button>
          <button type="button" className="biq-btn" onClick={() => setF0((v) => Math.min(0.45, +(v + 0.02).toFixed(2)))}>+</button>
          <span className="biq-lab">Q</span>
          <button type="button" className="biq-btn" onClick={() => setQ((v) => Math.max(0.3, +(v - 0.5).toFixed(1)))}>−</button>
          <button type="button" className="biq-btn" onClick={() => setQ((v) => Math.min(12, +(v + 0.5).toFixed(1)))}>+</button>
          <span className="biq-read">f0 {(f0 * 100).toFixed(0)}% Nyq · Q {Q.toFixed(1)} · |pole| {poleMag(coeffs(type, f0, Q)).toFixed(3)}</span>
        </div>
      )}
    />
  );
}

function Filt({ phase, type, f0, Q, onType, onF0, onQ }: { phase: Phase; type: FType; f0: number; Q: number; onType?: (t: FType) => void; onF0?: (v: number) => void; onQ?: (v: number) => void }) {
  const on = (p: Phase) => phase === p; void onType; void onF0; void onQ;
  const bq = coeffs(type, f0, Q); const pm = poleMag(bq);
  // pole-zero plot (left)
  const PZ = 130, PZY = 150, PZR = 78;
  const pd = bq.a1 * bq.a1 - 4 * bq.a2; // pole coords
  const poles = pd < 0 ? [[-bq.a1 / 2, Math.sqrt(-pd) / 2], [-bq.a1 / 2, -Math.sqrt(-pd) / 2]] : [[(-bq.a1 + Math.sqrt(pd)) / 2, 0], [(-bq.a1 - Math.sqrt(pd)) / 2, 0]];
  const zd = bq.b1 * bq.b1 - 4 * bq.b0 * bq.b2;
  const zeros = zd < 0 ? [[-bq.b1 / (2 * bq.b0), Math.sqrt(-zd) / (2 * bq.b0)], [-bq.b1 / (2 * bq.b0), -Math.sqrt(-zd) / (2 * bq.b0)]] : [[(-bq.b1 + Math.sqrt(zd)) / (2 * bq.b0), 0], [(-bq.b1 - Math.sqrt(zd)) / (2 * bq.b0), 0]];
  // response curve (right)
  const RX = 300, RW = 412, RY = 44, RH = 150, MAXM = 2.6;
  const resp = Array.from({ length: 200 }, (_, i) => { const w = i / 199 * Math.PI; const m = Math.min(Hmag(bq, w), MAXM); return `${RX + i / 199 * RW},${RY + RH - m / MAXM * RH}`; }).join(' ');
  const cutX = RX + f0 * 2 * RW; // f0 as fraction of Nyquist (0..0.5 → 0..1)
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="18" className="biq-col">Biquad · {TYPES.find((t) => t.id === type)!.label} · y[n]=b0x[n]+b1x[n-1]+b2x[n-2]−a1y[n-1]−a2y[n-2] · |pole| {pm.toFixed(3)} {pm < 1 ? '(stable)' : '(UNSTABLE)'}</text>

      {/* pole-zero plot */}
      <text x={PZ} y={PZY - PZR - 10} className="biq-lbl" textAnchor="middle">poles × / zeros ○ · z-plane</text>
      <circle cx={PZ} cy={PZY} r={PZR} className="biq-circle" />
      <line x1={PZ - PZR - 8} y1={PZY} x2={PZ + PZR + 8} y2={PZY} className="biq-axis" />
      <line x1={PZ} y1={PZY - PZR - 8} x2={PZ} y2={PZY + PZR + 8} className="biq-axis" />
      {zeros.map((z, i) => Math.abs(z[0]) < 3 && Math.abs(z[1]) < 3 && <circle key={i} cx={PZ + z[0] * PZR} cy={PZY - z[1] * PZR} r="5" className="biq-zero" />)}
      {poles.map((p, i) => <g key={i}><line x1={PZ + p[0] * PZR - 4} y1={PZY - p[1] * PZR - 4} x2={PZ + p[0] * PZR + 4} y2={PZY - p[1] * PZR + 4} className="biq-pole" /><line x1={PZ + p[0] * PZR - 4} y1={PZY - p[1] * PZR + 4} x2={PZ + p[0] * PZR + 4} y2={PZY - p[1] * PZR - 4} className="biq-pole" /></g>)}

      {/* frequency response */}
      <text x={RX} y={RY - 8} className="biq-lbl">frequency response |H| — DC ← → Nyquist</text>
      <line x1={RX} y1={RY + RH} x2={RX + RW} y2={RY + RH} className="biq-axis" />
      <line x1={RX} y1={RY + RH - 1 / MAXM * RH} x2={RX + RW} y2={RY + RH - 1 / MAXM * RH} className="biq-unity" />
      <text x={RX + RW + 2} y={RY + RH - 1 / MAXM * RH + 4} className="biq-u">1</text>
      <polyline points={resp} className="biq-resp" />
      <line x1={cutX} y1={RY} x2={cutX} y2={RY + RH} className="biq-cut" />
      <text x={cutX} y={RY + RH + 13} className="biq-cutl" textAnchor="middle">f0 (cutoff)</text>

      <text x="380" y="292" className="biq-foot" textAnchor="middle">
        {on('formula') ? 'five coefficients + feedback (IIR) → a filter that can resonate'
          : on('response') ? '|H(e^jω)|: how much of each frequency passes — lowpass here'
          : on('polezero') ? 'zeros notch, poles peak; poles must stay inside the unit circle'
          : on('resonance') ? 'pole → unit circle = higher Q = taller, narrower peak'
          : on('cascade') ? 'cascade biquads for steeper filters; the unit of every EQ'
          : `${TYPES.find((t) => t.id === type)!.label} · f0 ${(f0*100).toFixed(0)}% Nyq · Q ${Q.toFixed(1)} · |pole| ${pm.toFixed(3)}`}
      </text>
    </svg>
  );
}
