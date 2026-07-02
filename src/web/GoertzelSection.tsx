// Guided story: the Goertzel algorithm — detect ONE frequency cheaply, the way a phone decodes touch-tones (DTMF).
// A full FFT computes every frequency; Goertzel computes a single DFT bin with a two-tap recursive filter tuned to the
// target, resonating at it. Cost is O(N) per frequency vs the FFT's O(N log N) for all N — a win when you want only a
// few. Verified in node: Goertzel equals the DFT bin to the last digit, and detects DTMF digits (770+1336 Hz = '5').
// Real Goertzel over a synthesized DTMF signal. Sandboxed/CONCEPTUAL.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const FS = 8000, N = 205;
const ROWF = [697, 770, 852, 941], COLF = [1209, 1336, 1477];
const KEYS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']];
function goertzel(x: number[], f: number): number {
  const k = Math.round(N * f / FS), w = 2 * Math.PI * k / N, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0; for (let n = 0; n < N; n++) { const s = x[n] + c * s1 - s2; s2 = s1; s1 = s; }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}
function bank(r: number, c: number) {
  const x = Array.from({ length: N }, (_, n) => Math.sin(2 * Math.PI * ROWF[r] * n / FS) + Math.sin(2 * Math.PI * COLF[c] * n / FS));
  const mags = [...ROWF, ...COLF].map((f) => goertzel(x, f));
  const peak = Math.max(...mags);
  return { mags: mags.map((m) => m / peak), rowPeak: ROWF[r], colPeak: COLF[c] };
}

type Phase = 'one' | 'dtmf' | 'filter' | 'mag' | 'cheap' | 'run';

export function GoertzelSection() {
  const [rc, setRc] = useState<[number, number]>([1, 1]); // '5'
  const b = useMemo(() => bank(rc[0], rc[1]), [rc]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Gz phase={key} rc={[1, 1]} b={bank(1, 1)} /> });

  const scenes: StoryScene[] = [
    scene('one', 'When you need just one frequency', 'Sometimes you don’t want a whole spectrum — you just need to know whether a specific frequency is present: a carrier, a specific pitch, a phone touch-tone. A full FFT computes every frequency at once, which is far more than you asked for.'),
    scene('dtmf', 'Each key is two tones', 'A touch-tone keypad encodes every key as two simultaneous sine waves — one from its row, one from its column. Press 5 and the phone sends 770 Hz plus 1336 Hz together. To decode a keypress, the other end only has to check these seven frequencies.'),
    scene('filter', 'Goertzel: a resonant filter', 'For each target frequency, run a tiny two-tap recursive filter tuned to it: sₙ = xₙ + 2·cos(2πk/N)·sₙ₋₁ − sₙ₋₂, keeping only the last two values. It resonates at that frequency the way a wine glass rings at its pitch — energy at the target builds up while everything else cancels out.'),
    scene('mag', 'Read the magnitude at the end', 'After N samples, combine the last two filter states: s₁² + s₂² − 2·cos(2πk/N)·s₁·s₂. That is exactly the magnitude of that one DFT frequency bin — obtained from a single multiply-add per sample. The two tones in the signal light up; the other six stay near zero.'),
    scene('cheap', 'Cheaper than an FFT — for a few bins', 'An FFT is O(N log N) and hands you all N frequencies; Goertzel is O(N) for each frequency you actually want. For DTMF’s handful of tones that’s far less work — which is why it decoded telephone keypads on tiny 1980s DSP chips. It’s the sweet spot between one frequency and all of them.'),
    { key: 'run', title: 'Press a key', caption: 'Press a keypad digit and watch its two tones — one row, one column — light up the Goertzel detector bank while the other frequencies stay flat, and the digit is read back. Each bar is one two-tap filter resonating (or not) at its frequency. No FFT, just seven cheap detectors.', render: () => <Gz phase="run" rc={rc} b={b} onKey={setRc} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Sometimes you don’t need a whole spectrum — you just need to know whether a specific frequency is present. A phone decoding touch-tones only cares about a handful of frequencies, so computing a full FFT (every frequency at once) is wasteful. The <strong>Goertzel algorithm</strong> computes a single DFT frequency bin with a tiny recursive filter, tuned like a resonator to the frequency you’re listening for.</>,
        takeaway: <>For a target frequency corresponding to DFT bin k, Goertzel runs a two-tap recursive filter over the samples: <code>sₙ = xₙ + 2·cos(2πk/N)·sₙ₋₁ − sₙ₋₂</code>, keeping only the last two values. The filter resonates at the target frequency — energy there accumulates while everything else cancels — and after N samples the bin magnitude is <code>s₁² + s₂² − 2·cos(2πk/N)·s₁·s₂</code>, which equals the full DFT’s value for that bin to the last digit (verified). The cost is one multiply and a couple of adds per sample: O(N) for one frequency, versus the FFT’s O(N log N) to compute all N of them. So when you only care about a few frequencies — DTMF’s touch-tones, a carrier detector, a specific pitch — Goertzel is far cheaper, which is exactly why it decoded telephone keypads on tiny 1980s DSP chips. It’s the sweet spot between one frequency (Goertzel) and all of them (FFT).</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <span className="gz-live">decoded: <b>{KEYS[ROWF.indexOf(b.rowPeak)][COLF.indexOf(b.colPeak)]}</b> · {b.rowPeak} Hz + {b.colPeak} Hz — press a key on the pad</span>
      )}
    />
  );
}

function Gz({ phase, rc, b, onKey }: { phase: Phase; rc: [number, number]; b: ReturnType<typeof bank>; onKey?: (rc: [number, number]) => void }) {
  const on = (p: Phase) => phase === p;
  const allF = [...ROWF, ...COLF];
  const showBank = on('mag') || on('cheap') || on('run') || on('dtmf');
  const KX = 90, KY = 96, BW = 74, BH = 52;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="34" className="gz-col">DTMF touch-tone decode · Goertzel filter bank{showBank ? ` · key ${KEYS[rc[0]][rc[1]]} = ${b.rowPeak}+${b.colPeak} Hz` : ''}</text>

      {/* keypad */}
      {KEYS.map((rowk, r) => rowk.map((label, c) => {
        const active = r === rc[0] && c === rc[1];
        return (
          <g key={label} onClick={onKey ? () => onKey([r, c]) : undefined} style={{ cursor: onKey ? 'pointer' : 'default' }}>
            <rect x={KX + c * (BW + 6)} y={KY + r * (BH + 6)} width={BW} height={BH} rx="8" className={`gz-key ${active ? 'on' : ''}`} />
            <text x={KX + c * (BW + 6) + BW / 2} y={KY + r * (BH + 6) + BH / 2 + 7} className="gz-keyt" textAnchor="middle">{label}</text>
          </g>
        );
      }))}
      {ROWF.map((f, r) => <text key={f} x={KX - 8} y={KY + r * (BH + 6) + BH / 2 + 4} className="gz-frq" textAnchor="end">{f}</text>)}
      {COLF.map((f, c) => <text key={f} x={KX + c * (BW + 6) + BW / 2} y={KY - 8} className="gz-frq" textAnchor="middle">{f}</text>)}

      {/* filter formula (filter scene) */}
      {on('filter') && <text x="470" y="150" className="gz-form">sₙ = xₙ + 2·cos(2πk/N)·sₙ₋₁ − sₙ₋₂</text>}
      {on('filter') && <text x="470" y="176" className="gz-form2">one multiply-add per sample · keeps only s₁, s₂</text>}

      {/* detector bank */}
      {showBank && <>
        <text x="470" y="86" className="gz-blbl">Goertzel magnitude per frequency</text>
        {allF.map((f, i) => {
          const m = b.mags[i], lit = f === b.rowPeak || f === b.colPeak; const y = 104 + i * 40;
          return (
            <g key={f}>
              <text x="530" y={y + 14} className="gz-frq" textAnchor="end">{f}</text>
              <rect x="540" y={y} width="260" height="20" rx="4" className="gz-barbg" />
              <rect x="540" y={y} width={Math.max(2, m * 260)} height="20" rx="4" className={`gz-bar ${lit ? 'lit' : ''}`} />
              {lit && <text x={540 + m * 260 + 8} y={y + 15} className="gz-peak">◄ tone</text>}
            </g>
          );
        })}
      </>}

      {(on('cheap') || on('run')) && <text x="470" y="440" className="gz-cost">FFT: O(N log N) for all N · Goertzel: O(N) × 7 bins</text>}

      <text x="450" y="466" className="gz-foot" textAnchor="middle">
        {on('one') ? 'need one frequency? an FFT computes them all — overkill'
          : on('dtmf') ? 'each key = one row tone + one column tone, sent together'
          : on('filter') ? 'a two-tap filter tuned to resonate at the target frequency'
          : on('mag') ? 'the two present tones spike; the rest stay near zero'
          : on('cheap') ? 'O(N) per wanted bin beats O(N log N) for all of them'
          : `decoded ${KEYS[rc[0]][rc[1]]} — two tones lit, five flat`}
      </text>
    </svg>
  );
}
