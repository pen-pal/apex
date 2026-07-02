// Guided story: autocorrelation pitch detection — how a tuner / Auto-Tune finds a note's fundamental frequency. A
// pitched sound repeats, so slide the waveform against a delayed copy of itself; the lag where it best matches is one
// period, and pitch = sample rate / period. Robust to timbre (keys on repetition, not the spectrum) and handles the
// missing fundamental (harmonics alone still repeat at the fundamental period). Real autocorrelation verified in node:
// recovers 220/147 Hz, and STILL finds 220 with the fundamental removed. Distinct from FFT/Goertzel. Sandboxed.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const FS = 8000, N = 1024;
function signal(f0: number, withFund: boolean): number[] {
  const harm: [number, number][] = withFund ? [[1, 1], [2, 0.6], [3, 0.4], [4, 0.25]] : [[2, 0.6], [3, 0.4], [4, 0.25]];
  return Array.from({ length: N }, (_, n) => harm.reduce((s, [h, a]) => s + a * Math.sin(2 * Math.PI * f0 * h * n / FS), 0));
}
function autocorr(x: number[]): number[] { const r: number[] = []; for (let lag = 0; lag < 300; lag++) { let s = 0; for (let n = 0; n < N - lag; n++) s += x[n] * x[n + lag]; r.push(s); } return r; }
function detect(r: number[]): { lag: number; hz: number } {
  let lag = 1; while (lag < r.length - 1 && r[lag] >= r[lag - 1]) lag++; // past the lag-0 peak
  let best = lag, bv = -Infinity; for (let i = lag; i < r.length - 1; i++) if (r[i] > r[i - 1] && r[i] > r[i + 1] && r[i] > bv) { bv = r[i]; best = i; }
  const d = r[best - 1] - 2 * r[best] + r[best + 1]; const refined = d !== 0 ? best + (r[best - 1] - r[best + 1]) / (2 * d) : best; // parabolic
  return { lag: best, hz: FS / refined };
}

const noteName = (hz: number) => { const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; const m = Math.round(69 + 12 * Math.log2(hz / 440)); return names[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); };

type Phase = 'what' | 'slide' | 'peak' | 'timbre' | 'missing' | 'run';

export function PitchSection() {
  const [f0, setF0] = useState(220);
  const [fund, setFund] = useState(true);
  const x = useMemo(() => signal(f0, fund), [f0, fund]);
  const r = useMemo(() => autocorr(x), [x]);
  const det = detect(r);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, withF: boolean): StoryScene => {
    const xs = signal(220, withF), rs = autocorr(xs);
    return { key, title, caption, render: () => <Pitch phase={key} x={xs} r={rs} det={detect(rs)} /> };
  };

  const scenes: StoryScene[] = [
    scene('what', 'What pitch is this?', 'A guitar tuner, Auto-Tune, a music app — all need the fundamental frequency of a sound. An FFT shows every frequency at once, but a real note is a stack of harmonics, and picking THE pitch out of that stack is fiddly. Autocorrelation finds the repeating period directly.', true),
    scene('slide', 'Slide the signal against itself', 'A pitched sound repeats. So take the waveform and a delayed copy of it: at most delays the two don’t line up, but shift by exactly one period and the copy sits right on top of the original. Multiply them point-by-point and sum — that sum spikes when they align.', true),
    scene('peak', 'The first peak is the period', 'Do that for every lag and you get the autocorrelation curve. It’s maximal at lag 0 (a signal always matches itself), dips, then peaks again at exactly one period — and at every multiple. The first strong peak after zero is the fundamental period T; the pitch is the sample rate ÷ T.', true),
    scene('timbre', 'Robust to timbre', 'A violin and a flute on the same note have completely different spectra — different harmonics, different brightness — but the same period. Autocorrelation keys on repetition, not on which harmonics are present, so it gives the same pitch for both. Timbre changes the waveform’s shape, not how often it repeats.', true),
    scene('missing', 'The missing fundamental', 'Here’s the surprising part: remove the fundamental frequency entirely, keep only its harmonics — and the waveform STILL repeats at the fundamental period, so autocorrelation still reports it. It’s why you hear the bass line on a tiny phone speaker that physically can’t reproduce those low notes.', false),
    { key: 'run', title: 'Tune it', caption: 'Change the pitch and watch the autocorrelation peak slide — a lower note has a longer period, so the peak moves right — while the detected frequency and note name track it. Flip off the fundamental and keep only the harmonics: the peak, and the detected pitch, barely move. Repetition is what carries pitch.', render: () => <Pitch phase="run" x={x} r={r} det={det} fund={fund} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To detect the pitch of a sound — for a guitar tuner, Auto-Tune, or a music app — you need its fundamental frequency. You could take an FFT and hunt for the lowest strong peak, but a real note is a stack of harmonics and that’s fiddly. <strong>Autocorrelation</strong> finds it differently: a pitched sound repeats, so slide the waveform against a delayed copy of itself, and the delay at which it best lines up with itself is exactly one period.</>,
        takeaway: <>Autocorrelation is the signal times a shifted copy of itself, summed, for each shift (lag): <code>r(τ) = Σ x[n]·x[n+τ]</code>. At τ = 0 it’s maximal (everything matches itself); as the lag grows it falls and rises, hitting a strong peak whenever the shift equals a whole number of periods. The first peak after zero is the fundamental period T, and the pitch is the sample rate divided by T (refined with a parabolic fit for sub-sample accuracy). Because it keys on <strong>repetition</strong> rather than on the spectrum, it’s robust to timbre — a violin and a flute on the same note have very different harmonics but the same period, so the same answer — and it handles the <strong>missing fundamental</strong>: strip out the fundamental and keep only the harmonics, and the waveform still repeats at the fundamental period, so autocorrelation still reports it (which is why you perceive the bass note on a speaker too small to physically produce it). Real detectors refine this — normalizing it, or subtracting instead of multiplying (the YIN difference function) to avoid octave errors — but the core is this slide-against-yourself idea, cheap enough to run in real time on every tuner and voice app.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="pit-ctl">
          <label className="pit-lbl">pitch<input type="range" min={110} max={440} value={f0} onChange={(e) => setF0(+e.target.value)} /><b>{f0} Hz</b></label>
          <button type="button" className={`pit-btn ${!fund ? 'on' : ''}`} onClick={() => setFund((v) => !v)}>{fund ? 'remove fundamental' : 'fundamental removed'}</button>
          <span className="pit-live">detected {det.hz.toFixed(0)} Hz ({noteName(det.hz)})</span>
        </div>
      )}
    />
  );
}

function Pitch({ phase, x, r, det, fund = true }: { phase: Phase; x: number[]; r: number[]; det: { lag: number; hz: number }; fund?: boolean }) {
  const on = (p: Phase) => phase === p;
  const WX = 80, WW = 760, WY = 150, WH = 80; // waveform panel
  const AX = 80, AW = 760, AY = 380, AH = 120; // autocorr panel
  const nWave = 260;
  const wmax = Math.max(...x.slice(0, nWave).map(Math.abs)) || 1;
  const wpts = Array.from({ length: nWave }, (_, i) => `${WX + (i / nWave) * WW},${WY - (x[i] / wmax) * WH}`);
  const rmax = r[0] || 1;
  const apts = r.map((v, lag) => `${AX + (lag / r.length) * AW},${AY - (v / rmax) * AH}`);
  const peakX = AX + (det.lag / r.length) * AW;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="34" className="pit-col">waveform{on('missing') || (on('run') && !fund) ? ' (fundamental removed — still periodic)' : ''}</text>
      {/* waveform */}
      <line x1={WX} y1={WY} x2={WX + WW} y2={WY} className="pit-axis" />
      <polyline points={wpts.join(' ')} className="pit-wave" fill="none" />
      {/* delayed copy (slide scene) */}
      {on('slide') && <polyline points={Array.from({ length: nWave }, (_, i) => `${WX + (i / nWave) * WW},${WY - ((x[i + det.lag] ?? 0) / wmax) * WH + 4}`).join(' ')} className="pit-wave2" fill="none" />}
      {on('slide') && <text x={WX + (det.lag / nWave) * WW} y={WY + 60} className="pit-note" textAnchor="middle">↤ one period: the copy lines up ↦</text>}

      {/* autocorrelation */}
      {!on('what') && !on('slide') && <>
        <text x="60" y={AY - AH - 16} className="pit-col">autocorrelation r(lag) = Σ x[n]·x[n+lag]</text>
        <line x1={AX} y1={AY} x2={AX + AW} y2={AY} className="pit-axis" />
        <polyline points={apts.join(' ')} className="pit-acf" fill="none" />
        <line x1={peakX} y1={AY - AH} x2={peakX} y2={AY + 6} className="pit-peak" />
        <circle cx={peakX} cy={AY - (r[det.lag] / rmax) * AH} r="4" className="pit-peakdot" />
        <text x={peakX} y={AY + 22} className="pit-peaklbl" textAnchor="middle">period → {det.hz.toFixed(0)} Hz ({noteName(det.hz)})</text>
        <text x={AX + 4} y={AY - AH + 12} className="pit-note">lag 0 (self-match)</text>
      </>}

      <text x="450" y="462" className="pit-foot" textAnchor="middle">
        {on('what') ? 'a note is many harmonics stacked — which one is the pitch?'
          : on('slide') ? 'shift by one period and the copy matches → their product sums high'
          : on('peak') ? 'first peak after lag 0 = the period; pitch = sample rate ÷ period'
          : on('timbre') ? 'same period, different harmonics → same detected pitch'
          : on('missing') ? 'no fundamental, yet the peak — and the pitch — are unchanged'
          : `detected ${det.hz.toFixed(0)} Hz (${noteName(det.hz)})${!fund ? ' — fundamental removed' : ''}`}
      </text>
    </svg>
  );
}
