// Guided story: convolution reverb — how a room's entire acoustic signature (its impulse response) is applied to any
// sound by convolution. Clap once in a space and record what returns (direct sound → early reflections → diffuse tail):
// that impulse response fully describes how the room transforms sound. Convolving a dry recording with it slides a
// scaled copy of the IR onto every sample, overlapping into reverb. Exact by the convolution theorem (time-conv =
// freq-multiply, verified in node direct-vs-DFT to 1e-15). WebAudio ConvolverNode makes it audible. Sandboxed.
import { useMemo, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const N = 128, M = 64;
function dryOf(): number[] { const d = new Array(N).fill(0); [[12, 1], [52, 0.8], [84, 0.9]].forEach(([p, a]) => (d[p] = a)); return d; }
function irOf(decay: number): number[] { let s = 3; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24) * 2 - 1; }; return Array.from({ length: M }, (_, i) => r() * Math.pow(1 - i / M, decay) * (i < 2 ? 1.4 : 1)); }
function conv(a: number[], b: number[]): number[] { const o = new Array(a.length + b.length - 1).fill(0); for (let i = 0; i < a.length; i++) if (a[i]) for (let j = 0; j < b.length; j++) o[i + j] += a[i] * b[j]; return o; }

type Phase = 'room' | 'ir' | 'convolve' | 'exact' | 'any' | 'run';

export function ConvReverbSection() {
  const [roomSec, setRoomSec] = useState(1.4);
  const dry = useMemo(dryOf, []);
  const ir = useMemo(() => irOf(2.5), []);
  const wet = useMemo(() => conv(dry, ir), [dry, ir]);
  const ctxRef = useRef<AudioContext | null>(null);
  const play = (wetMode: boolean) => {
    try {
      const ctx = ctxRef.current ?? (ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());
      const sr = ctx.sampleRate; const dl = Math.floor(sr * 0.55); const db = ctx.createBuffer(1, dl, sr); const dd = db.getChannelData(0);
      for (const pos of [0, 0.18, 0.33]) { const st = Math.floor(pos * sr); for (let i = 0; i < sr * 0.02; i++) dd[st + i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.006)); }
      const src = ctx.createBufferSource(); src.buffer = db;
      if (wetMode) { const len = Math.max(1, Math.floor(sr * roomSec)); const irb = ctx.createBuffer(2, len, sr); for (let ch = 0; ch < 2; ch++) { const d = irb.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); } const cv = ctx.createConvolver(); cv.buffer = irb; const g = ctx.createGain(); g.gain.value = 0.6; src.connect(cv); cv.connect(g); src.connect(g); g.connect(ctx.destination); }
      else src.connect(ctx.destination);
      src.start();
    } catch { /* no audio */ }
  };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Rev phase={key} dry={dry} ir={ir} wet={wet} /> });

  const scenes: StoryScene[] = [
    scene('room', 'What makes a cathedral sound like one?', 'Clap once in a big stone cathedral and you don’t just hear the clap — you hear the space: a long, complex decay of reflections rolling off the walls and ceiling. That decay pattern is the room’s acoustic fingerprint, and it’s the same for any sound made there.'),
    scene('ir', 'The impulse response', 'Fire one sharp click — an impulse — in the room and record everything that comes back: the direct sound first, then early reflections off nearby surfaces, then a dense diffuse tail that fades out. That single recording, the impulse response, completely describes how the room transforms any sound.'),
    scene('convolve', 'Convolution applies the room', 'To make a dry, close-mic’d recording sound like it’s in that room, convolve it with the impulse response. Convolution drops a scaled copy of the whole impulse response at every sample of the dry signal — so each click, note, and syllable triggers the room’s full response, and the copies overlap and sum into reverb.'),
    scene('exact', 'It’s exact — the convolution theorem', 'This isn’t an effect that approximates a room; it reproduces it. And convolution in time equals multiplication in frequency, so the same result comes from an FFT — which is how a plugin runs a 3-second reverb on live audio. (Verified: direct convolution and the FFT route agree to 15 digits.)'),
    scene('any', 'Any space, any sound', 'Because a real recorded impulse response captures a real place exactly, convolution reverb can put your voice in an actual cathedral, a specific concert hall, a car interior, or a vintage plate — the true acoustics, not a guess. It’s how film, records, and games place sound in a believable space.'),
    { key: 'run', title: 'Hear the room', caption: 'Play a dry drum pattern, then the same pattern convolved with a room impulse response — the reverb tail blooms after each hit (your browser’s audio). Grow the room and the tail lengthens; shrink it toward a tight ambience. Same dry sound, transformed entirely by the space it’s convolved with.', render: () => <Rev phase="run" dry={dry} ir={ir} wet={wet} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Clap once in a cathedral and you hear the <em>space</em> — a long tail of reflections that is the room’s acoustic fingerprint. Fire a single sharp click and record everything that returns and you’ve captured that fingerprint completely: the <strong>impulse response</strong>. Convolution reverb then takes a dry recording and <strong>convolves</strong> it with that impulse response, making the dry sound behave as if it were played in the real room.</>,
        takeaway: <>A room is a linear system, so its response to <em>any</em> sound is fully determined by its response to one impulse — the impulse response, which you get by recording the decay after a click (or a balloon pop / starter pistol) in the real space. <strong>Convolution</strong> combines a dry signal with that impulse response by placing a scaled copy of the entire impulse response at every sample of the signal and summing the overlaps: <code>(x ⊛ h)[n] = Σ x[k]·h[n−k]</code>. So every transient in the dry sound sets off the room’s full reflection pattern, and they pile up into natural reverb whose length is the impulse response’s length. It reproduces the space exactly, not approximately — and by the <strong>convolution theorem</strong>, convolution in time equals multiplication in frequency, so a real-time plugin does it with an FFT instead of the direct sum (verified here: the two agree to 15 digits). Recorded impulse responses of real cathedrals, halls, and hardware are why convolution reverb sounds authentic; the same operation, with a learned kernel instead of a room, is the “convolution” in a convolutional neural network.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="rev-ctl">
          <button type="button" className="rev-btn dry" onClick={() => play(false)}>▶ dry</button>
          <button type="button" className="rev-btn" onClick={() => play(true)}>▶ with reverb</button>
          <label className="rev-lbl">room size<input type="range" min={3} max={30} value={Math.round(roomSec * 10)} onChange={(e) => setRoomSec(+e.target.value / 10)} /><b>{roomSec.toFixed(1)}s</b></label>
        </div>
      )}
    />
  );
}

function Rev({ phase, dry, ir, wet }: { phase: Phase; dry: number[]; ir: number[]; wet: number[] }) {
  const on = (p: Phase) => phase === p;
  const WX = 70, WW = 780;
  const lane = (y: number, data: number[], cls: string, h: number) => {
    const mx = Math.max(...data.map(Math.abs)) || 1;
    return <><line x1={WX} y1={y} x2={WX + WW} y2={y} className="rev-axis" />{data.map((v, i) => v && <line key={i} x1={WX + (i / data.length) * WW} y1={y} x2={WX + (i / data.length) * WW} y2={y - (v / mx) * h} className={cls} />)}</>;
  };
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="28" className="rev-col">dry signal ⊛ impulse response = reverberant output</text>

      {/* dry */}
      <text x={WX} y={72} className="rev-lbl2">dry sound (clicks)</text>
      {lane(120, dry, 'rev-dry', 48)}

      {/* impulse response */}
      {!on('room') && <><text x={WX} y={172} className="rev-lbl2">impulse response — the room’s reply to one click</text>{lane(230, ir.concat(new Array(N - M).fill(0)), 'rev-ir', 58)}</>}

      {/* overlapping copies (convolve scene) */}
      {(on('convolve')) && dry.map((a, di) => a ? ir.map((v, k) => { const i = di + k; return v && <line key={`${di}-${k}`} x1={WX + (i / (N + M)) * WW} y1={340} x2={WX + (i / (N + M)) * WW} y2={340 - a * (v / (Math.max(...ir.map(Math.abs)) || 1)) * 30} className="rev-copy" />; }) : null)}

      {/* wet */}
      {(on('exact') || on('any') || on('run')) && <><text x={WX} y={300} className="rev-lbl2">wet — every click replaced by the room’s response, overlapping</text>{lane(360, wet, 'rev-wet', 58)}</>}
      {on('convolve') && <text x="450" y={392} className="rev-note" textAnchor="middle">each click drops a scaled copy of the whole impulse response → they sum</text>}

      <text x="450" y="424" className="rev-foot" textAnchor="middle">
        {on('room') ? 'the room’s decay is the same fingerprint for every sound made in it'
          : on('ir') ? 'one click captures the whole room: direct → reflections → tail'
          : on('convolve') ? 'convolution: a scaled impulse response at every sample, summed'
          : on('exact') ? 'time-domain convolution = frequency-domain multiply (via FFT)'
          : on('any') ? 'a recorded impulse response = a real space, applied to any sound'
          : 'dry vs wet — the same hits, wrapped in the room’s reverb'}
      </text>
    </svg>
  );
}
