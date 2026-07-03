// Guided story #15: how a keystroke reaches the screen — the full-stack journey, on the GuidedStory engine. Press
// a key and it crosses hardware, an interrupt, the OS, your app, and the display before you see a letter. Scenes:
// the key matrix + scancode, the interrupt, the driver→event, the focused app, rasterize→framebuffer→pixels, then a
// live run — press the key and watch the signal travel all five stages with the latency added at each hop.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const STAGES = [
  { key: 'kbd', title: 'keyboard', detail: 'scancode 0x1C', us: 0 },
  { key: 'irq', title: 'CPU · interrupt', detail: 'IRQ → driver', us: 50 },
  { key: 'os', title: 'OS', detail: "keymap → 'a' → event", us: 200 },
  { key: 'app', title: 'app', detail: "keydown 'a' → buffer", us: 400 },
  { key: 'disp', title: 'display', detail: 'glyph → framebuffer', us: 8000 },
];
// a tiny 5×7 bitmap of lowercase 'a'
const GLYPH = ['00000', '01110', '00001', '01111', '10001', '01111', '00000'];

type Phase = 'matrix' | 'irq' | 'os' | 'app' | 'render' | 'run';
const PHASE_STAGE: Record<Phase, number> = { matrix: 0, irq: 1, os: 2, app: 3, render: 4, run: -1 };

export function KeystrokeSection() {
  const [reached, setReached] = useState(-1); // -1 idle; 0..4 stage reached; 5 done

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Path phase={key} reached={PHASE_STAGE[key]} /> });

  const scenes: StoryScene[] = [
    narrated('matrix', 'The key matrix', 'A keyboard is a grid of switches. Press a key and it closes one row/column crossing. A tiny controller scans the grid, sees which switch closed, and emits a scancode — a number for the physical key, not the letter on it.'),
    narrated('irq', 'A hardware interrupt', 'The scancode travels over USB or Bluetooth to the computer, and the controller raises an interrupt: a hardware signal that makes the CPU stop whatever it was doing and jump to the keyboard driver right away.'),
    narrated('os', 'Driver → an input event', 'The driver reads the scancode and runs it through the keymap — scancode to keycode to character, taking Shift and your layout into account. It posts a tidy input event onto the OS event queue.'),
    narrated('app', 'To the focused window', 'The windowing system hands the event to whichever window has focus. That app’s event loop dequeues a keydown for “a” and updates its own state — inserting the character into its text buffer.'),
    narrated('render', 'Rasterize → framebuffer → pixels', 'The app redraws: it rasterizes the glyph from a font into a grid of pixels and writes them into the framebuffer. The display controller scans that memory out to the monitor line by line, and the letter finally appears.'),
    { key: 'run', title: 'Press it and follow along', caption: 'Press the key and watch the signal cross all five stages, gathering a little latency at each hop. End to end it is only a few milliseconds — which is why typing feels instant, and why the display scan-out (the slowest hop) is what a low-latency gamer optimizes.', render: () => <Path phase="run" reached={reached} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Pressing a key and seeing a letter feels instant, but the signal actually crosses the entire computing stack to get there — the keyboard hardware, a CPU interrupt, the kernel, your application, and the display — each layer handing off to the next. This follows one keypress the whole way through.</>,
        takeaway: <>The keyboard’s own controller scans a grid of switches, emits a scancode (a number for the physical key), sends it over USB, and raises a hardware interrupt that yanks the CPU into the driver. The kernel maps the scancode to a character through your layout, queues an input event, and delivers it to the focused window; the app updates its state and redraws, rasterizing the glyph into the framebuffer that the display then scans out to the panel. It is only a few milliseconds end to end — and the slowest hop, the display’s scan-out, is the one a low-latency gamer works hardest to shrink.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" onClick={() => setReached((r) => (r >= 4 ? -1 : r + 1))}>{reached >= 4 ? '↻ reset' : reached < 0 ? 'press “a” ▶' : `→ ${STAGES[reached + 1].title}`}</button>
          <span className="kst-live">{reached < 0 ? 'idle' : reached >= 4 ? '“a” on screen · ~8.7 ms total' : `at: ${STAGES[reached].title}`}</span>
        </>
      )}
    />
  );
}

function Path({ phase, reached }: { phase: Phase; reached: number }) {
  const on = (p: Phase) => phase === p;
  const cumUs = (i: number) => STAGES.slice(0, i + 1).reduce((a, s) => a + s.us, 0);
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {STAGES.map((st, i) => {
        const active = on('run') ? i <= reached : PHASE_STAGE[phase] === i;
        const cur = on('run') ? i === reached : PHASE_STAGE[phase] === i;
        const x = 20 + i * 176;
        return (
          <g key={st.key}>
            {i > 0 && <line x1={x - 16} y1={200} x2={x} y2={200} className="kst-link" markerEnd="url(#kst-arr)" />}
            {i > 0 && cur && on('run') && <line className="kst-flow" x1={x - 16} y1={200} x2={x} y2={200} pathLength={100} />}
            <rect x={x} y={150} width={160} height={100} rx="8" className={`kst-stage ${active ? 'on' : ''} ${cur ? 'cur' : ''}`} />
            <text x={x + 80} y={178} className="kst-stage-lbl" textAnchor="middle">{st.title}</text>
            <text x={x + 80} y={204} className="kst-stage-detail" textAnchor="middle">{st.detail}</text>
            {active && <text x={x + 80} y={228} className="kst-stage-lat" textAnchor="middle">+{st.us < 1000 ? `${st.us}µs` : `${(st.us / 1000).toFixed(1)}ms`}</text>}
            <text x={x + 80} y={130} className="kst-stage-idx" textAnchor="middle">{['⌨ hardware', 'CPU', 'OS kernel', 'application', 'GPU · monitor'][i]}</text>
          </g>
        );
      })}
      {/* the key at the start */}
      {(on('matrix') || (on('run') && reached >= 0)) && <text x="100" y="300" className="kst-key" textAnchor="middle">A</text>}
      {/* the rendered glyph at the end */}
      {(on('render') || (on('run') && reached >= 4)) && (
        <g>
          {GLYPH.map((row, r) => [...row].map((c, col) => c === '1' ? <rect key={`${r}-${col}`} x={800 + col * 12} y={290 + r * 12} width={10} height={10} className="kst-pixel" /> : null))}
          <text x="822" y="392" className="kst-stage-detail" textAnchor="middle">pixels</text>
        </g>
      )}
      <text x="450" y="452" className="kst-foot" textAnchor="middle">
        {on('matrix') ? 'a switch closes → the controller emits a scancode for the physical key'
          : on('irq') ? 'an interrupt makes the CPU run the driver immediately'
          : on('os') ? 'the keymap turns a scancode into a character and an event'
          : on('app') ? 'the focused app’s event loop receives the keydown'
          : on('render') ? 'the glyph is rasterized to the framebuffer and scanned to the screen'
          : (reached < 0 ? 'press the key to send it on its way' : reached >= 4 ? `total ~${(cumUs(4) / 1000).toFixed(1)} ms — feels instant` : `reached ${STAGES[reached].title} · ${(cumUs(reached) / 1000).toFixed(2)} ms so far`)}
      </text>
      <defs><marker id="kst-arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="kst-arrhead" /></marker></defs>
    </svg>
  );
}
