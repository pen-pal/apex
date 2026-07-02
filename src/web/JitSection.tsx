// Guided story #14: how a JIT makes code fast — profile, compile hot code to native, speculate, deoptimize. On the
// GuidedStory engine, and the sequel to the bytecode-VM story (#12): interpreting is portable but slow, so real
// runtimes (V8, the JVM, PyPy) compile the hot parts to machine code at run time. Scenes: interpreting is slow,
// profiling finds hot code, compile+specialize, swap in the native code, speculate & deopt, then a live loop — run
// it, watch the counter cross the threshold and the JIT kick in, then break a type assumption and watch it deopt.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const THRESHOLD = 10000;
type Phase = 'slow' | 'profile' | 'compile' | 'swap' | 'deopt' | 'run';

export function JitSection() {
  const [calls, setCalls] = useState(0);
  const [broke, setBroke] = useState(false); // fed it a surprising type → deopt
  const hot = calls >= THRESHOLD;
  const native = hot && !broke;

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Jit phase={key} calls={key === 'slow' ? 30 : key === 'profile' ? 9200 : 12000} native={key === 'swap'} broke={key === 'deopt'} /> });

  const scenes: StoryScene[] = [
    narrated('slow', 'Interpreting is slow', 'A bytecode VM is portable, but every instruction costs a fetch and a switch in software. Run a loop a million times and that overhead dominates. Yet almost all the time lives in just a few hot loops — so what if we compiled only those to real machine code?'),
    narrated('profile', 'Profile — find the hot code', 'The VM keeps a cheap counter on each function and loop. Every time one runs, the counter ticks up. When a counter crosses a threshold — say ten thousand — that code is declared hot and worth compiling. Cold code is left interpreted; compiling it would never pay off.'),
    narrated('compile', 'Compile it to native — and specialize', 'A background compiler turns the hot bytecode into native instructions. Crucially it specializes to the types it actually saw: if this loop only ever added integers, it emits plain integer adds and drops the interpreter’s generic, boxed, type-checking dispatch.'),
    narrated('swap', 'Swap in the fast version', 'The next call jumps straight into the native code instead of the interpreter. Same result, often 10 to 100 times faster. This is why a loop mysteriously speeds up after it has run a while — the JIT quietly replaced it.'),
    narrated('deopt', 'Speculate, then deoptimize', 'That native code assumed the values stay integers. If one call suddenly passes a string, the assumption is wrong — so the JIT bails out (deoptimizes) back to the safe interpreter for that call. Fast in the common case, still correct in the rare one.'),
    { key: 'run', title: 'Warm it up yourself', caption: 'Run the loop. Watch the call counter climb; when it crosses the threshold the JIT compiles it and the speed jumps. Then feed it a surprising type and watch it deoptimize straight back to the interpreter.', render: () => <Jit phase="run" calls={calls} native={native} broke={broke} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" onClick={() => setCalls((c) => Math.min(20000, c + 4000))}>run ×4,000</button>
          <button type="button" onClick={() => setBroke(true)} disabled={!native}>feed it a string</button>
          <button type="button" onClick={() => { setCalls(0); setBroke(false); }}>reset</button>
          <span className={`jit-live ${native ? 'fast' : ''}`}>{broke && calls >= THRESHOLD ? 'deoptimized → interpreter (1×)' : native ? 'JIT native (~50×)' : `interpreter (1×) · ${calls}/${THRESHOLD}`}</span>
        </>
      )}
    />
  );
}

function Jit({ phase, calls, native, broke }: { phase: Phase; calls: number; native: boolean; broke: boolean }) {
  const on = (p: Phase) => phase === p;
  const hot = calls >= THRESHOLD;
  const pct = Math.min(100, (calls / THRESHOLD) * 100);
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* the hot function + counter */}
      <rect x="300" y="40" width="300" height="66" rx="8" className={`jit-fn ${hot ? 'hot' : ''}`} />
      <text x="450" y="66" className="jit-fn-lbl" textAnchor="middle">for i in a: sum += a[i]</text>
      <text x="450" y="90" className="jit-fn-sub" textAnchor="middle">call counter: {calls.toLocaleString()}{hot ? '  🔥 hot' : ''}</text>
      {/* threshold bar */}
      <rect x="300" y="120" width="300" height="12" rx="6" className="jit-bar" />
      <rect x="300" y="120" width={3 * pct} height="12" rx="6" className={`jit-bar-fill ${hot ? 'hot' : ''}`} />
      <text x="610" y="130" className="jit-bar-lbl">hot at {THRESHOLD.toLocaleString()}</text>

      {/* interpreter path (left) */}
      <rect x="90" y="200" width="300" height="150" rx="10" className={`jit-path ${!native ? 'active' : 'dim'}`} />
      <text x="240" y="228" className="jit-path-lbl" textAnchor="middle">bytecode interpreter</text>
      <text x="240" y="256" className="jit-path-sub" textAnchor="middle">fetch · decode · switch · repeat</text>
      <text x="240" y="300" className={`jit-speed ${!native ? 'on' : ''}`} textAnchor="middle">~1×</text>
      <text x="240" y="328" className="jit-path-sub" textAnchor="middle">portable, generic, boxed</text>

      {/* native path (right) */}
      <rect x="510" y="200" width="300" height="150" rx="10" className={`jit-path native ${native ? 'active' : 'dim'}`} />
      <text x="660" y="228" className="jit-path-lbl" textAnchor="middle">JIT native code</text>
      <text x="660" y="256" className="jit-path-sub" textAnchor="middle">{on('compile') ? 'specialized to ints seen' : 'add rax, rbx · … '}</text>
      <text x="660" y="300" className={`jit-speed fast ${native ? 'on' : ''}`} textAnchor="middle">~50×</text>
      <text x="660" y="328" className="jit-path-sub" textAnchor="middle">specialized, unboxed</text>

      {/* which path is taken */}
      <text x="450" y="180" className="jit-flow-lbl" textAnchor="middle">calls go to →</text>
      {(on('compile')) && <line className="jit-flow" x1="410" y1="275" x2="510" y2="275" pathLength={100} />}
      {broke && <text x="660" y="360" className="jit-deopt" textAnchor="middle">✗ deopt — a string appeared</text>}

      <text x="450" y="452" className="jit-foot" textAnchor="middle">
        {on('slow') ? 'the hot loop dominates runtime — compile just that'
          : on('profile') ? 'cheap counters decide what is worth compiling'
          : on('compile') ? 'native + type-specialized: no generic dispatch'
          : on('swap') ? 'the loop silently gets 10–100× faster mid-run'
          : on('deopt') ? 'a broken assumption falls back to the interpreter, safely'
          : (broke && hot ? 'deoptimized: back on the safe interpreter' : native ? 'running native — ~50× faster' : hot ? 'hot — the JIT compiles it' : 'keep running to cross the threshold')}
      </text>
    </svg>
  );
}
