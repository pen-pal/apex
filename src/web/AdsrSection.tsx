// Guided story: the ADSR envelope — the four-stage amplitude contour that shapes every synthesizer note. Flipping an
// oscillator on/off clicks (an instant jump has infinite high-frequency content), so an envelope multiplies the tone's
// amplitude with a smooth Attack→Decay→Sustain→Release shape. Attack/Decay/Release are durations; Sustain is a LEVEL held
// while the key (gate) is down. Release falls from the CURRENT level, so staccato and legato both sound natural. The same
// four-knob contour also modulates filter cutoff, pitch, and FM index — an envelope is a reusable control signal. Verified
// in node: the segment breakpoints hit exactly (peak at A, sustain at A+D, zero at release end), the contour is continuous
// at every boundary including gate-off, and release starts from the current level. Sandboxed/CONCEPTUAL DSP.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type P = { A: number; D: number; S: number; R: number };
function env(t: number, p: P, tOff: number | null): number {
  if (t < 0) return 0;
  if (tOff == null || t <= tOff) { if (t < p.A) return t / p.A; if (t < p.A + p.D) return 1 - (1 - p.S) * (t - p.A) / p.D; return p.S; }
  const lvl = env(tOff, p, null); if (t < tOff + p.R) return lvl * (1 - (t - tOff) / p.R); return 0;
}
const PRESETS = [
  { id: 'pluck', label: 'pluck', p: { A: 0.01, D: 0.18, S: 0.0, R: 0.12 }, hold: 0.25 },
  { id: 'pad', label: 'pad', p: { A: 0.35, D: 0.2, S: 0.7, R: 0.5 }, hold: 0.9 },
  { id: 'organ', label: 'organ', p: { A: 0.01, D: 0.02, S: 1.0, R: 0.03 }, hold: 0.8 },
  { id: 'stab', label: 'stab', p: { A: 0.01, D: 0.09, S: 0.35, R: 0.06 }, hold: 0.2 },
];

type Phase = 'why' | 'onset' | 'sustain' | 'release' | 'reuse' | 'run';
export function AdsrSection() {
  const [pi, setPi] = useState(1); const [holdMul, setHoldMul] = useState(1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, presetIdx: number): StoryScene =>
    ({ key, title, caption, render: () => <Env phase={key} pi={presetIdx} holdMul={1} /> });

  const scenes: StoryScene[] = [
    scene('why', 'Why a note needs a shape', 'Flip an oscillator straight on and off and you hear a click — an instant jump from silence to full volume has infinite high-frequency content. Real instruments swell and fade. An ADSR envelope multiplies the oscillator’s amplitude by a smooth four-stage contour, turning a raw tone into a note with a beginning, middle, and end.', 1),
    scene('onset', 'Attack and decay: the onset', 'When a key is pressed — the gate opens — the envelope rises from 0 to full over the Attack time, then falls to the Sustain level over the Decay time. A fast attack with a short decay is a percussive pluck; a slow attack is a swelling pad. The onset (the first few milliseconds) is what your ear uses to tell a piano from a violin.', 0),
    scene('sustain', 'Sustain is a level, not a time', 'While the key stays held, the envelope holds at the Sustain level — the one ADSR parameter that is a level (0–1), not a duration. An organ sustains at full forever; a plucked string has a Sustain near 0, so the note keeps decaying toward silence even while you hold it. Sustain sets how the middle of the note behaves.', 2),
    scene('release', 'Release: letting go', 'When the key lifts — the gate closes — the envelope falls from wherever it currently is down to 0 over the Release time. Falling from the CURRENT level is what makes it musical: let go during the attack and it eases down from that partial height, not from full, so a quick tap and a long hold both sound natural. (Verified: the contour is continuous at every boundary, including gate-off.)', 3),
    scene('reuse', 'Same four knobs, many destinations', 'Analog envelopes are exponential — a capacitor charging and discharging — which is why their decays sound natural; digital ones may be linear or shaped. And the very same four-stage signal isn’t only a volume knob: patch it to filter cutoff for a “wah,” to pitch for a blip, or to an FM index for a bright-then-mellow attack. An envelope is a reusable control signal. (Verified: breakpoints hit exactly.)', 1),
    { key: 'run', title: 'Shape a note', caption: 'Pick a voice — pluck, pad, organ, stab — and change how long the key is held. Watch the amplitude contour and the sound it carves out of the oscillator: a sharp pluck that dies instantly, a pad that swells and lingers, an organ that snaps on and off. Hold briefly to release mid-attack and see the contour ease down from wherever it was.', render: () => <Env phase="run" pi={pi} holdMul={holdMul} onPi={setPi} onHold={setHoldMul} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>An <strong>ADSR envelope</strong> shapes a synth note’s loudness over time with four stages: <strong>Attack</strong> (rise 0→full), <strong>Decay</strong> (fall to the sustain level), <strong>Sustain</strong> (hold while the key is down), <strong>Release</strong> (fall to 0 when released). A, D, R are <em>times</em>; S is a <em>level</em>. It exists because switching a tone on instantly clicks — a smooth contour avoids that and gives the note a recognizable onset. Release falls from the <strong>current</strong> level, and the same four-knob signal also modulates filter, pitch, or FM depth.</>,
        takeaway: <>The <strong>ADSR envelope generator</strong> is the core modulation source in subtractive and FM synthesis, defining how a parameter (classically <strong>amplitude</strong>) evolves across a note. It’s driven by a <strong>gate</strong> signal (key down / key up). <strong>Attack</strong>: on gate-on, ramp from 0 to the peak over the attack time. <strong>Decay</strong>: fall from the peak to the <strong>Sustain</strong> level over the decay time. <strong>Sustain</strong>: hold that level — note it is a <em>level</em> (0–1), the only one of the four that isn’t a duration — for as long as the gate stays on. <strong>Release</strong>: on gate-off, fall from the current value to 0 over the release time. Two design points matter. First, release (and every stage) proceeds from the <strong>current</strong> output, not a fixed value, so releasing mid-attack eases down from the partial level — this keeps fast and slow playing both click-free and is why the contour is continuous everywhere. Second, real analog envelopes are <strong>exponential</strong> (an RC capacitor charging toward a target and discharging), giving the natural-sounding decays that a purely linear ramp lacks; digital designs choose linear, exponential, or arbitrary curves, and often let attack overshoot. The envelope’s reason for existing is the <strong>click</strong> problem: a discontinuous amplitude step contains energy at all frequencies (a spectral splat), so even a 1–5 ms attack/release ramp is needed to avoid pops. Crucially the ADSR is a general <strong>control signal</strong>, not just a VCA driver: routed to a <strong>filter cutoff</strong> it makes the classic bass “wah,” to <strong>pitch</strong> a percussive blip, to an <strong>FM operator’s index</strong> a bright attack that mellows (the DX7 uses multi-stage rate/level envelopes per operator). Variants generalize the shape: <strong>AD</strong> (percussion, no sustain), <strong>DAHDSR</strong> (adds delay and hold), and full multi-segment envelopes; the attack transient it shapes is, along with the spectrum, one of the two things the ear uses to identify a timbre.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="adsr-ctl">
          {PRESETS.map((pr, i) => <button key={pr.id} type="button" className={`adsr-btn ${pi === i ? 'on' : ''}`} onClick={() => setPi(i)}>{pr.label}</button>)}
          <span className="adsr-sep">|</span>
          <span className="adsr-lab">hold</span>
          {[0.25, 1, 2].map((h) => <button key={h} type="button" className={`adsr-btn ${holdMul === h ? 'on' : ''}`} onClick={() => setHoldMul(h)}>{h === 0.25 ? 'tap' : h === 1 ? 'normal' : 'long'}</button>)}
          <span className="adsr-read">A {PRESETS[pi].p.A * 1000 | 0}ms · D {PRESETS[pi].p.D * 1000 | 0}ms · S {PRESETS[pi].p.S.toFixed(2)} · R {PRESETS[pi].p.R * 1000 | 0}ms</span>
        </div>
      )}
    />
  );
}

function Env({ phase, pi, holdMul, onPi, onHold }: { phase: Phase; pi: number; holdMul: number; onPi?: (v: number) => void; onHold?: (v: number) => void }) {
  const on = (p: Phase) => phase === p; void onPi; void onHold;
  const preset = PRESETS[pi]; const p = preset.p; const tOff = Math.max(p.A + 0.005, preset.hold * holdMul);
  const TMAX = tOff + p.R + 0.08;
  const OX = 56, OW = 656, EY = 40, EH = 120, WY = 176, WH = 74;
  const X = (t: number) => OX + t / TMAX * OW; const Y = (v: number) => EY + EH - v * EH;
  const N = 400;
  const contour = Array.from({ length: N + 1 }, (_, i) => { const t = i / N * TMAX; return `${X(t)},${Y(env(t, p, tOff))}`; }).join(' ');
  const wave = Array.from({ length: N + 1 }, (_, i) => { const t = i / N * TMAX; const e = env(t, p, tOff); const s = Math.sin(2 * Math.PI * 30 * t); return `${X(t)},${WY + WH / 2 - s * e * WH / 2}`; }).join(' ');
  const offX = X(tOff);
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="adsr-col">ADSR envelope · “{preset.label}” · amplitude over time · A rise → D fall to S → hold S → R fall to 0 on key-up</text>

      {/* envelope area */}
      <line x1={OX} y1={EY + EH} x2={OX + OW} y2={EY + EH} className="adsr-axis" />
      <line x1={OX} y1={EY} x2={OX} y2={EY + EH} className="adsr-axis" />
      <polyline points={`${OX},${EY + EH} ${contour} ${OX + OW},${EY + EH}`} className="adsr-fill" />
      <polyline points={contour} className="adsr-line" />

      {/* gate on/off markers */}
      <line x1={OX} y1={EY - 6} x2={OX} y2={EY + EH} className="adsr-gate" />
      <text x={OX + 3} y={EY - 8} className="adsr-gt">key down (gate on)</text>
      <line x1={offX} y1={EY - 6} x2={offX} y2={EY + EH} className="adsr-gate off" />
      <text x={offX + 3} y={EY - 8} className="adsr-gt off">key up</text>

      {/* phase labels */}
      {(() => { const segs = [['A', 0, p.A], ['D', p.A, p.A + p.D], ['S', p.A + p.D, tOff], ['R', tOff, tOff + p.R]] as [string, number, number][];
        return segs.filter(([, a, b]) => b - a > 0.001).map(([lab, a, b]) => <text key={lab} x={(X(a) + X(b)) / 2} y={EY + EH + 15} className="adsr-seg" textAnchor="middle">{lab}</text>); })()}

      {/* waveform (oscillator × envelope) */}
      <text x={OX} y={WY - 6} className="adsr-lbl">the sound: oscillator × envelope</text>
      <line x1={OX} y1={WY + WH / 2} x2={OX + OW} y2={WY + WH / 2} className="adsr-axis2" />
      <polyline points={wave} className="adsr-wave" />

      <text x="380" y="292" className="adsr-foot" textAnchor="middle">
        {on('why') ? 'an instant on/off clicks; a smooth contour gives the note a shape'
          : on('onset') ? 'Attack rises to full, Decay falls to the sustain level — the onset'
          : on('sustain') ? 'Sustain is a LEVEL held while the key is down (0 = dies, 1 = organ)'
          : on('release') ? 'key-up: Release falls from the CURRENT level to 0 — always smooth'
          : on('reuse') ? 'route the same contour to filter, pitch, or FM depth, not just volume'
          : `${preset.label}: A ${p.A*1000|0}ms · D ${p.D*1000|0}ms · S ${p.S.toFixed(2)} · R ${p.R*1000|0}ms`}
      </text>
    </svg>
  );
}
