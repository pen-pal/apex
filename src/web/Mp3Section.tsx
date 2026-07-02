// Guided story: how MP3 shrinks audio using psychoacoustic masking — the ear's counterpart to JPEG's exploitation of
// the eye. Any sound is a spectrum; your ear has an absolute threshold of hearing (frequency-dependent), and a loud
// tone raises that threshold around itself, masking quieter neighbours. MP3 computes this threshold and drops every
// component below it. Real model: the Terhardt absolute-threshold-of-hearing curve + a Bark-domain spreading function
// (verified in node — ATH dips at ~3 kHz; a loud tone masks a quiet neighbour). Perceptual coding, sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

// real psychoacoustic model
const ATH = (f: number) => { const k = f / 1000; return 3.64 * Math.pow(k, -0.8) - 6.5 * Math.exp(-0.6 * Math.pow(k - 3.3, 2)) + 1e-3 * Math.pow(k, 4); }; // dB SPL
const bark = (f: number) => 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan(Math.pow(f / 7500, 2));
const maskThresh = (f: number, fm: number, Lm: number) => Lm - 27 * Math.abs(bark(f) - bark(fm));
const combined = (f: number, fm: number, Lm: number) => Math.max(ATH(f), maskThresh(f, fm, Lm));

type Tone = { f: number; L: number };
const QUIET: Tone[] = [{ f: 200, L: 42 }, { f: 520, L: 31 }, { f: 1250, L: 34 }, { f: 2600, L: 24 }, { f: 4200, L: 20 }, { f: 9000, L: 43 }, { f: 14000, L: 30 }];

const F0 = 50, F1 = 16000, OX = 70, OW = 760, OY = 360, OH = 300;
const fx = (f: number) => OX + (Math.log(f) - Math.log(F0)) / (Math.log(F1) - Math.log(F0)) * OW;
const ly = (dB: number) => OY - Math.max(-10, Math.min(90, dB)) / 90 * OH;

type Phase = 'spectrum' | 'ath' | 'masking' | 'drop' | 'jpeg' | 'run';

export function Mp3Section() {
  const [maskerF, setMaskerF] = useState(1000);
  const maskerL = 82;
  const kept = QUIET.filter((t) => t.L > combined(t.f, maskerF, maskerL)).length;

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, mf: number): StoryScene =>
    ({ key, title, caption, render: () => <Spec phase={key} maskerF={mf} maskerL={maskerL} /> });

  const scenes: StoryScene[] = [
    scene('spectrum', 'A sound is a spectrum', 'Any slice of audio is a mix of frequencies, each with a loudness. Transform it (an FFT) and you get a bar chart: energy per frequency. To compress it, you don’t need to keep the bars you can’t hear — and that is most of them.', 1000),
    scene('ath', 'Your ear isn’t a microphone', 'The ear has an absolute threshold of hearing: sounds quieter than this curve are inaudible. And it isn’t flat — you’re most sensitive around 3–4 kHz and nearly deaf to very low and very high frequencies. Anything under the curve, you never hear, so there’s no reason to store it.', 1000),
    scene('masking', 'Loud sounds hide quiet ones', 'Now the powerful part: a loud tone raises the threshold around its own frequency. A quieter tone right next to it drops below the raised curve and becomes inaudible — masked. It’s why you can’t hear a whisper next to a jackhammer, and why the tone near this loud one vanishes from what you perceive.', 1000),
    scene('drop', 'Drop everything below the curve', 'MP3 computes this threshold from the actual signal, then throws away every frequency component beneath it (greyed) — they were inaudible anyway. What remains, it quantizes only as coarsely as it can while keeping the quantization noise under the threshold. Fewer bars, fewer bits.', 1000),
    scene('jpeg', 'Perceptual coding — like JPEG', 'This is the same idea as JPEG, in a different sense. JPEG spends bits only on the visual detail the eye notices and discards the rest; MP3 spends bits only on the sound the ear can hear and discards what masking hides. Both are lossy by design: the waveform changes, but below the threshold of what a human can perceive.', 1000),
    { key: 'run', title: 'Move the loud tone', caption: 'Slide the loud tone across the spectrum and watch its masking bump sweep along the threshold curve — quiet tones fall under it and grey out (dropped), then re-emerge as it moves away. The tones near the low and high edges stay dropped no matter what: they’re below the ear’s absolute threshold to begin with.', render: () => <Spec phase="run" maskerF={maskerF} maskerL={maskerL} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Any sound is a mix of frequencies, and MP3’s insight is that your ear doesn’t hear all of them. There is an <strong>absolute threshold of hearing</strong> — very quiet sounds are inaudible — and, crucially, a loud sound <strong>raises</strong> that threshold around its own frequency, so a quieter sound nearby becomes inaudible too. That’s <em>masking</em> (why you can’t hear a whisper next to a jackhammer). MP3 computes this threshold from the actual signal and simply discards every frequency component that falls below it — you were never going to hear them.</>,
        takeaway: <>The encoder transforms a short window of audio into a frequency spectrum, computes the masking threshold the loud components impose on their neighbours (on top of the absolute threshold of hearing, which is worst at low and very high frequencies), then does two things: drop every component below the threshold entirely, and quantize the rest only as finely as needed to keep the quantization noise <em>under</em> the threshold. Coarser quantization means fewer bits, and the noise it adds is inaudible by construction. This is <strong>perceptual coding</strong> — the same principle as JPEG, spend bits only on what a human perceives — and it’s why an MP3 is roughly 10× smaller than the raw audio yet sounds the same. It is lossy by design: the waveform is different, but below the threshold of what you can hear. (Opus and AAC use richer versions of the same model.)</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="mp3-ctl">loud tone frequency<input type="range" min={150} max={12000} step={50} value={maskerF} onChange={(e) => setMaskerF(+e.target.value)} /><b>{maskerF < 1000 ? `${maskerF} Hz` : `${(maskerF / 1000).toFixed(1)} kHz`}</b></label>
          <span className="mp3-live">{kept}/{QUIET.length} tones audible · {QUIET.length - kept} dropped (inaudible)</span>
        </>
      )}
    />
  );
}

function Spec({ phase, maskerF, maskerL }: { phase: Phase; maskerF: number; maskerL: number }) {
  const on = (p: Phase) => phase === p;
  const athOnly = on('ath');
  const greyDropped = on('drop') || on('jpeg') || on('run');
  const thr = (f: number) => (athOnly ? ATH(f) : combined(f, maskerF, maskerL));
  // sample the threshold curve across log-frequency
  const N = 80; const pts: string[] = [];
  for (let i = 0; i <= N; i++) { const f = Math.exp(Math.log(F0) + (i / N) * (Math.log(F1) - Math.log(F0))); pts.push(`${fx(f).toFixed(1)},${ly(thr(f)).toFixed(1)}`); }
  const showCurve = !on('spectrum');
  const allTones: (Tone & { masker?: boolean })[] = [{ f: maskerF, L: maskerL, masker: true }, ...QUIET];
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="34" className="mp3-col">frequency spectrum — loudness (dB) vs frequency (log Hz)</text>
      {/* axes */}
      <line x1={OX} y1={OY} x2={OX + OW} y2={OY} className="mp3-axis" />
      {[100, 1000, 10000].map((f) => <text key={f} x={fx(f)} y={OY + 18} className="mp3-tick" textAnchor="middle">{f < 1000 ? `${f}Hz` : `${f / 1000}kHz`}</text>)}

      {/* threshold curve + shaded inaudible region below it */}
      {showCurve && <>
        <polyline points={pts.join(' ')} className={`mp3-curve ${athOnly ? 'ath' : ''}`} fill="none" />
        <polygon points={`${OX},${OY} ${pts.join(' ')} ${OX + OW},${OY}`} className="mp3-inaud" />
        <text x={OX + OW - 4} y={ly(thr(F1)) - 8} className="mp3-curvelbl" textAnchor="end">{athOnly ? 'threshold of hearing' : 'masking threshold'}</text>
      </>}

      {/* tone bars */}
      {allTones.map((t, i) => {
        const dropped = greyDropped && !t.masker && t.L <= combined(t.f, maskerF, maskerL);
        return (
          <g key={i}>
            <rect x={fx(t.f) - 5} y={ly(t.L)} width="10" height={OY - ly(t.L)} rx="2" className={`mp3-bar ${t.masker ? 'masker' : dropped ? 'dropped' : 'kept'}`} />
            {t.masker && <text x={fx(t.f)} y={ly(t.L) - 6} className="mp3-mlbl" textAnchor="middle">loud tone</text>}
          </g>
        );
      })}

      <text x="450" y="452" className="mp3-foot" textAnchor="middle">
        {on('spectrum') ? 'each bar is a frequency component; most cost bits you can’t hear'
          : on('ath') ? 'sounds under the curve are inaudible — most sensitive near 3–4 kHz'
          : on('masking') ? 'the loud tone lifts the threshold around it → its quiet neighbour is masked'
          : on('drop') ? 'grey bars fell below the threshold → dropped; nobody hears the difference'
          : on('jpeg') ? 'spend bits only on what a human perceives — the JPEG principle, for the ear'
          : 'move the loud tone: its masking bump sweeps, hiding different quiet tones'}
      </text>
    </svg>
  );
}
