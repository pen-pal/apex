// Guided story: Karplus-Strong synthesis — a strikingly realistic plucked-string sound from a delay line + averaging.
// A string's wave makes a round trip at a fixed period = pitch; model it as a buffer of length L (the delay), filled
// with a noise burst (the pluck) and looped. Each cycle, replace each sample with the average of it and the next — a
// low-pass that kills high harmonics fast (bright attack mellows) while the buffer-length shape survives at pitch fs/L.
// Verified in node: pitch ≈ fs/L, and it decays like a real string. Simplest physical-modeling synthesis. Sandboxed.
import { useMemo, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const seeded = (n: number) => { let s = 99; const r: number[] = []; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; r.push((s >>> 8) / (1 << 24) * 2 - 1); } return r; };
function ksOutput(L: number, damp: number, n: number): number[] {
  const buf = seeded(L).slice(); const out: number[] = []; let i = 0;
  for (let k = 0; k < n; k++) { out.push(buf[i]); buf[i] = damp * 0.5 * (buf[i] + buf[(i + 1) % L]); i = (i + 1) % L; }
  return out;
}

type Phase = 'string' | 'noise' | 'average' | 'pluck' | 'knobs' | 'run';

export function KarplusStrongSection() {
  const [freq, setFreq] = useState(147);
  const [damp, setDamp] = useState(0.996);
  const L = Math.round(8000 / freq); // display delay length at a nominal 8 kHz
  const out = useMemo(() => ksOutput(Math.min(120, L), damp, 900), [L, damp]);
  const ctxRef = useRef<AudioContext | null>(null);
  const pluck = () => {
    try {
      const ctx = ctxRef.current ?? (ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());
      const sr = ctx.sampleRate, len = Math.max(2, Math.round(sr / freq)), N = Math.round(sr * 1.6);
      const b = ctx.createBuffer(1, N, sr), d = b.getChannelData(0); const dl = new Float32Array(len);
      for (let i = 0; i < len; i++) dl[i] = Math.random() * 2 - 1;
      let idx = 0; for (let k = 0; k < N; k++) { d[k] = dl[idx] * 0.5; dl[idx] = damp * 0.5 * (dl[idx] + dl[(idx + 1) % len]); idx = (idx + 1) % len; }
      const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start();
    } catch { /* audio unavailable */ }
  };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <KS phase={key} out={ksOutput(54, 0.996, 900)} L={54} freq={148} /> });

  const scenes: StoryScene[] = [
    scene('string', 'A string is a delay line', 'Pluck a guitar string and a wave races down it, reflects off the end, and comes back — a round trip that repeats at a fixed period. That period is the pitch. Karplus-Strong models exactly this with a buffer used as a delay line, whose length L sets the period.'),
    scene('noise', 'Start with a burst of noise', 'Fill the buffer — length L — with random samples: a sharp, bright burst containing every frequency at once, like the instant a pick releases the string. Loop that buffer and it repeats every L samples, giving a buzzy tone at pitch = sample rate ÷ L.'),
    scene('average', 'Average as you go', 'Here’s the one extra step. Each time you read a sample, write back the average of it and its neighbour — a gentle low-pass filter. High-frequency wiggles flip sign sample-to-sample, so averaging cancels them fast; the slow, buffer-length shape barely changes and survives.'),
    scene('pluck', 'A plucked string appears', 'So the bright, noisy attack quickly mellows into a clean pitched tone that fades away — and because the high harmonics lose energy faster than the fundamental, it gets warmer as it decays, exactly like a real plucked string. From noise, a delay, and averaging: a convincing pluck.'),
    scene('knobs', 'The knobs are physical', 'Both controls mean something physical. The delay length L is the pitch — a longer string, a longer delay, a lower note (fs/L). The filter is the string’s energy loss: average harder and the tone decays faster and duller; lighter and it rings for longer. It’s the simplest physical-modeling synthesis.'),
    { key: 'run', title: 'Pluck it', caption: 'Press pluck to synthesize and hear a string (your browser’s audio). Slide the pitch — a lower note is a longer delay line — and the damping, which sets how fast and how dully it decays. The waveform shows the bright noisy attack settling into a smooth, fading tone. No recordings, just a delay and an average.', render: () => <KS phase="run" out={out} L={Math.min(120, L)} freq={freq} onPluck={pluck} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Pluck a guitar string and a wave races down it, reflects off the end, and returns — a round trip that repeats at a fixed period, and that period is the pitch. <strong>Karplus-Strong</strong> synthesis models this with almost nothing: a buffer used as a delay line (its length sets the period), filled with a burst of noise (the pluck) and looped, with one gentle smoothing step per cycle. Out comes a strikingly realistic plucked-string tone.</>,
        takeaway: <>Fill a buffer of length L with random samples — a bright, broadband burst like the instant a pick lets go — and read it out in a loop; on its own that repeats every L samples, a buzzy tone at <strong>pitch = sample rate ÷ L</strong>. The one addition is the physical model: each time you read a sample, write back the average of it and the next. That averaging is a low-pass filter, and because high-frequency content flips sign sample-to-sample it cancels out fast, while the smooth, buffer-length shape persists — so the noisy attack quickly settles into a clean pitched tone, and because the upper harmonics lose energy faster than the fundamental, it mellows as it fades, exactly like a real string (verified: pitch ≈ fs/L, with a natural decay). Two knobs, both physical: the delay length L is the pitch (a longer string is a lower note), and how strongly you filter is the string’s damping — average harder for a shorter, duller decay, lighter for a long ring. This is the seed of <strong>physical-modeling synthesis</strong>: the delay line stands in for the string’s wave-travel time, and richer versions (digital waveguides) add the bridge, body, and dispersion to synthesize whole instruments from their physics rather than from recordings.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="kps-ctl">
          <button type="button" className="kps-btn" onClick={pluck}>♪ pluck</button>
          <label className="kps-lbl">pitch<input type="range" min={80} max={330} value={freq} onChange={(e) => setFreq(+e.target.value)} /><b>{freq} Hz</b></label>
          <label className="kps-lbl">damping<input type="range" min={970} max={999} value={Math.round(damp * 1000)} onChange={(e) => setDamp(+e.target.value / 1000)} /></label>
        </div>
      )}
    />
  );
}

function KS({ phase, out, L, freq, onPluck }: { phase: Phase; out: number[]; L: number; freq: number; onPluck?: () => void }) {
  const on = (p: Phase) => phase === p;
  const noise = seeded(L);
  const WX = 70, WW = 780;
  // delay-line buffer strip
  const bufY = 130, bufH = 60;
  // output waveform
  const wY = 330, wH = 90;
  const wpts = out.map((v, i) => `${WX + (i / out.length) * WW},${wY - v * wH}`);
  return (
    <svg viewBox="0 0 900 480" className="story-svg" style={{ cursor: onPluck ? 'pointer' : 'default' }} onClick={onPluck}>
      <text x="60" y="34" className="kps-col">delay line: {L} samples · pitch fs/L ≈ {freq} Hz{onPluck ? ' · click to pluck' : ''}</text>

      {/* delay-line buffer (noise) */}
      {(on('string') || on('noise') || on('average') || on('run')) && <>
        <text x={WX} y={bufY - 14} className="kps-lbl2">the buffer (a loop of {L} samples){on('noise') || on('run') ? ' — random noise' : ''}</text>
        <line x1={WX} y1={bufY + bufH / 2} x2={WX + WW} y2={bufY + bufH / 2} className="kps-axis" />
        {noise.map((v, i) => { const x = WX + (i / L) * WW + (WW / L) / 2; const cy = bufY + bufH / 2; return <line key={i} x1={x} y1={cy} x2={x} y2={cy - v * bufH / 2} className="kps-samp" />; })}
        {/* feedback loop arrow */}
        <path d={`M ${WX + WW} ${bufY + bufH / 2} q 30 40 0 60 l ${-WW} 0 q -30 -20 0 -60`} className="kps-loop" fill="none" />
        {on('average') && <text x={WX + WW / 2} y={bufY + bufH + 40} className="kps-note" textAnchor="middle">each cycle: sampleᵢ ← ½(sampleᵢ + sampleᵢ₊₁) — a low-pass</text>}
      </>}

      {/* output waveform (decaying) */}
      {(on('pluck') || on('knobs') || on('run')) && <>
        <text x={WX} y={wY - wH - 6} className="kps-lbl2">output — bright attack decaying to a mellow tone</text>
        <line x1={WX} y1={wY} x2={WX + WW} y2={wY} className="kps-axis" />
        <polyline points={wpts.join(' ')} className="kps-wave" fill="none" />
      </>}

      <text x="450" y="462" className="kps-foot" textAnchor="middle">
        {on('string') ? 'a buffer of length L = the string’s round-trip period = the pitch'
          : on('noise') ? 'fill it with noise (the pluck); looped, it buzzes at fs/L'
          : on('average') ? 'average neighbours each pass → kills highs fast, keeps the pitch'
          : on('pluck') ? 'noisy attack → clean tone that mellows and fades, like a real string'
          : on('knobs') ? 'L sets the pitch (fs/L); the filter sets the decay — both physical'
          : `${freq} Hz · click anywhere or press pluck to hear it`}
      </text>
    </svg>
  );
}
