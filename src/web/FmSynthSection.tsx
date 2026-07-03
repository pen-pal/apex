// Guided story: FM synthesis (John Chowning 1973; the Yamaha DX7). A carrier oscillator's frequency is wobbled by a
// modulator: y(t) = sin(2π·f_c·t + I·sin(2π·f_m·t)). That one multiply-and-add in the phase sprouts a whole family of
// sidebands at f_c ± k·f_m, whose amplitudes are exactly the Bessel functions |J_k(I)| of the modulation index I. Raising
// I spreads energy into more, higher sidebands (a brightness knob; total energy Σ J_k(I)² = 1 stays constant). The ratio
// f_c:f_m picks the timbre: integer ratios put sidebands on a harmonic series (pitched/musical); irrational ratios scatter
// them inharmonically (bells, metal). Verified in node: DFT peaks land exactly at f_c ± k·f_m with amplitudes |J_k(I)|
// (max error 0.0000 with a clear carrier), energy is conserved, and sideband count tracks Carson's rule. CONCEPTUAL/DSP.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

// Bessel J_k(x) via the integral J_k(x) = (1/π)∫_0^π cos(kτ − x sin τ) dτ
function besselJ(k: number, x: number): number { const M = 900; let s = 0; for (let i = 0; i < M; i++) { const tau = Math.PI * (i + 0.5) / M; s += Math.cos(k * tau - x * Math.sin(tau)); } return s / M; }
const RATIOS = [{ label: '2:1', fc: 2, fm: 1, harm: true }, { label: '3:2', fc: 3, fm: 2, harm: true }, { label: '1:1', fc: 1, fm: 1, harm: true }, { label: '√2:1 bell', fc: 1.414, fm: 1, harm: false }];

type Phase = 'two' | 'sidebands' | 'bessel' | 'ratio' | 'why' | 'run';
export function FmSynthSection() {
  const [I, setI] = useState(3); const [ri, setRi] = useState(0);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, si: number, r: number): StoryScene =>
    ({ key, title, caption, render: () => <Fm phase={key} I={si} ri={r} /> });

  const scenes: StoryScene[] = [
    scene('two', 'One oscillator bending another', 'Additive synthesis stacks many sine oscillators to build a timbre. FM does it with two: a carrier whose frequency is wobbled by a modulator — y(t) = sin(2π·f_c·t + I·sin(2π·f_m·t)). John Chowning found in 1973 that this cheap operation makes astonishingly rich sounds; licensed to Yamaha, it became the DX7 and the sound of the 1980s.', 3, 0),
    scene('sidebands', 'Sidebands bloom around the carrier', 'Wobbling the carrier’s frequency doesn’t merely detune it — it sprouts a whole family of sidebands at f_c ± k·f_m for every integer k, spaced by the modulator frequency. One multiply-and-add in the phase creates dozens of partials at once. (Verified: DFT peaks land exactly at f_c ± k·f_m.)', 3, 0),
    scene('bessel', 'Bessel functions set the amplitudes', 'How loud is each sideband? Exactly |J_k(I)| — the k-th Bessel function of the modulation index I. As I grows, energy flows out of the carrier into more and higher sidebands, so I is a brightness knob; total power stays fixed (Σ J_k(I)² = 1). The spectrum is symmetric: |J_{−k}| = |J_k|. (Verified: amplitudes match the Bessel values, energy conserved.)', 6, 0),
    scene('ratio', 'The ratio picks the timbre', 'The carrier-to-modulator ratio f_c : f_m decides which partials appear. A simple integer ratio (2:1, 3:2) lands the sidebands on a harmonic series → a pitched, musical tone. An irrational ratio like √2:1 scatters them inharmonically → bells, mallets, metal. Same two oscillators, entirely different instrument.', 4, 3),
    scene('why', 'Why it took over', 'Two oscillators and a multiply replaced a bank of dozens — rich, evolving timbres cheap enough for an affordable digital synth. Envelope the modulation index I over time and the tone brightens on attack then mellows, exactly like a plucked or struck instrument. Carson’s rule: the audible bandwidth is about 2(I+1)·f_m. (Verified: sideband count tracks Carson.)', 5, 0),
    { key: 'run', title: 'Turn the two knobs', caption: 'Raise the modulation index and the sidebands bloom outward — the carrier drains into a bright, buzzy spectrum — while the waveform contorts from a pure sine into a complex shape. Switch the carrier:modulator ratio to move between harmonic (musical) and irrational (bell-like) timbres. Two knobs, a universe of sounds.', render: () => <Fm phase="run" I={I} ri={ri} onI={setI} onRi={setRi} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>FM synthesis</strong> wobbles one oscillator’s frequency with another: <code>y(t) = sin(2π·f_c·t + I·sin(2π·f_m·t))</code>. That sprouts <strong>sidebands</strong> at <strong>f_c ± k·f_m</strong>, with amplitudes given exactly by the <strong>Bessel functions |J_k(I)|</strong> of the modulation index <strong>I</strong> — so I is a brightness knob (more I ⇒ more, higher sidebands; total energy fixed). The <strong>ratio f_c:f_m</strong> sets the timbre: integer ⇒ harmonic/pitched, irrational ⇒ inharmonic/bell. Two oscillators make a whole orchestra of timbres — Chowning’s 1973 discovery, the Yamaha DX7.</>,
        takeaway: <><strong>Frequency-modulation synthesis</strong> (John Chowning, Stanford, 1973; licensed to Yamaha → the <strong>DX7</strong>, 1983) generates complex spectra from very few operations. A <strong>carrier</strong> sine has its instantaneous phase modulated by a <strong>modulator</strong> sine: <code>y(t) = sin(2πf_c t + I·sin(2πf_m t))</code>, where <strong>I</strong> is the <strong>modulation index</strong> (peak phase deviation). Expanding with the Jacobi–Anger identity gives <code>y(t) = Σ_k J_k(I)·sin(2π(f_c + k·f_m)t)</code>: the signal is a sum of sinusoids at the carrier plus <strong>sidebands</strong> at every <strong>f_c ± k·f_m</strong>, with amplitude the <strong>k-th Bessel function</strong> <code>J_k(I)</code>. Consequences: (1) as I increases, energy moves from the carrier into higher-order sidebands, widening the spectrum — I is effectively a <strong>brightness</strong> control, and enveloping I over a note’s duration mimics a real instrument’s spectral evolution (bright attack, mellow decay); (2) <strong>power is conserved</strong>, Σ_k J_k(I)² = 1, so brightening spreads rather than adds energy; (3) the amplitudes are <strong>symmetric</strong>, |J₋ₖ| = |Jₖ|; (4) the <strong>bandwidth</strong> follows <strong>Carson’s rule</strong>, ≈ 2(I+1)·f_m. The <strong>f_c:f_m ratio</strong> is the timbre selector: a rational ratio p:q makes all sidebands fall on a harmonic series with fundamental f_m/q (a pitched tone), while an irrational ratio produces <strong>inharmonic</strong> partials — bells, mallets, metallic and percussive sounds that additive/subtractive synthesis struggle to make cheaply. Lower sidebands that cross 0 Hz <strong>fold</strong> back with inverted phase and interfere, adding to the character. Real FM instruments chain multiple <strong>operators</strong> (the DX7 had 6, in selectable “algorithms”), each an oscillator+envelope, some acting as carriers and some as modulators, optionally with feedback. FM’s appeal was efficiency: a rich, evolving timbre from a couple of oscillators and a multiply, at a time when additive synthesis (one oscillator per partial) was far too expensive — which is why the DX7 became one of the best-selling synthesizers ever and defined a decade of pop.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="fm-ctl">
          <span className="fm-lab">index I = {I.toFixed(1)}</span>
          <button type="button" className="fm-btn" onClick={() => setI((v) => Math.max(0, +(v - 0.5).toFixed(1)))}>−</button>
          <button type="button" className="fm-btn" onClick={() => setI((v) => Math.min(9, +(v + 0.5).toFixed(1)))}>+</button>
          <span className="fm-sep">|</span>
          <span className="fm-lab">ratio</span>
          {RATIOS.map((r, i) => <button key={r.label} type="button" className={`fm-btn ${ri === i ? 'on' : ''}`} onClick={() => setRi(i)}>{r.label}</button>)}
          <span className="fm-read">{RATIOS[ri].harm ? 'harmonic (pitched)' : 'inharmonic (bell)'}</span>
        </div>
      )}
    />
  );
}

function Fm({ phase, I, ri, onI, onRi }: { phase: Phase; I: number; ri: number; onI?: (n: number) => void; onRi?: (n: number) => void }) {
  const on = (p: Phase) => phase === p; void onI; void onRi;
  const R = RATIOS[ri]; const fc = R.fc, fm = R.fm;
  // waveform y(t) over 2 modulator periods
  const WY = 66, WH = 54, OX = 60, OW = 640;
  const wave = Array.from({ length: 240 }, (_, i) => { const t = i / 240 * 2 / fm; const y = Math.sin(2 * Math.PI * fc * t + I * Math.sin(2 * Math.PI * fm * t)); return `${OX + i / 240 * OW},${WY + WH / 2 - y * WH / 2}`; }).join(' ');
  // spectrum: sidebands at k around carrier, height |J_k(I)|, symmetric; centred, stepped by fixed spacing
  const K = 8; const SC = 92, SB = 200, SP = OW / (2 * K + 2); const cx = OX + OW / 2;
  const bars = Array.from({ length: 2 * K + 1 }, (_, idx) => { const k = idx - K; return { k, x: cx + k * SP, amp: Math.abs(besselJ(k, I)) }; }).filter((b) => b.x >= OX && b.x <= OX + OW);
  const HB = 96;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="18" className="fm-col">FM · y(t) = sin(2π·f_c·t + I·sin(2π·f_m·t)) · I = {I.toFixed(1)} · f_c:f_m = {R.label} · {R.harm ? 'harmonic' : 'inharmonic'}</text>

      {/* waveform */}
      <text x={OX} y={WY - 4} className="fm-lbl">carrier bent by the modulator → this waveform</text>
      <line x1={OX} y1={WY + WH / 2} x2={OX + OW} y2={WY + WH / 2} className="fm-axis" />
      <polyline points={wave} className="fm-wave" />

      {/* spectrum */}
      <text x={OX} y={SC - 6} className="fm-lbl">its spectrum — sidebands at f_c ± k·f_m, height |J_k(I)|</text>
      <line x1={OX} y1={SB} x2={OX + OW} y2={SB} className="fm-axis" />
      {bars.map((b) => <g key={b.k}>
        <rect x={b.x - 5} y={SB - b.amp * HB} width={10} height={Math.max(0.5, b.amp * HB)} rx="1" className={b.k === 0 ? 'fm-carrier' : 'fm-side'} />
        {Math.abs(b.k) <= 4 && <text x={b.x} y={SB + 13} className="fm-kk" textAnchor="middle">{b.k === 0 ? 'f_c' : (b.k > 0 ? '+' : '') + b.k}</text>}
      </g>)}
      <text x={cx} y={SB + 28} className="fm-fund" textAnchor="middle">← spacing = f_m → · carrier (k=0) drains as I rises</text>

      <text x="380" y="292" className="fm-foot" textAnchor="middle">
        {on('two') ? 'two oscillators: a carrier whose frequency the modulator wobbles'
          : on('sidebands') ? 'sidebands appear at f_c ± k·f_m — one operation, many partials'
          : on('bessel') ? 'each height is |J_k(I)|; raise I and energy spreads outward (brighter)'
          : on('ratio') ? (R.harm ? 'integer ratio → sidebands on a harmonic series → musical' : 'irrational ratio → inharmonic partials → bell / metal')
          : on('why') ? 'envelope I over time → attack brightens, decay mellows, like a real instrument'
          : `I = ${I.toFixed(1)} → ${bars.filter((b) => b.amp > 0.02).length} significant sidebands · ${R.harm ? 'harmonic' : 'bell'}`}
      </text>
    </svg>
  );
}
