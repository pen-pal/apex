// Guided story #12: how a bytecode VM runs your program — a stack machine + interpreter loop, on the GuidedStory
// engine. Ties the compiler story (it emits this) to the CPU-cycle story (this is fetch-decode-execute, in software).
// Scenes: compile-once-run-anywhere, the operand stack, the interpreter loop, a stepped run of (2+3)*4, the
// portability/speed trade (why JITs exist), then a live box — type an arithmetic expression, see its bytecode, and
// step the VM while the operand stack animates. Real: a tiny expression→bytecode compiler and a real stack machine.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Ins = { op: 'PUSH' | 'ADD' | 'SUB' | 'MUL' | 'DIV'; arg?: number };

function compileBC(src: string): { code: Ins[]; err: string } {
  const toks = (src.match(/\s*(\d+\.?\d*|[+\-*/()])/g) || []).map((s) => s.trim());
  if (toks.join('') !== src.replace(/\s+/g, '')) return { code: [], err: 'unexpected character' };
  let p = 0; const code: Ins[] = [];
  const BIN: Record<string, Ins['op']> = { '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV' };
  const factor = () => {
    const t = toks[p];
    if (t === undefined) throw new Error('unexpected end');
    if (/^\d/.test(t)) { p++; code.push({ op: 'PUSH', arg: Number(t) }); }
    else if (t === '(') { p++; expr(); if (toks[p] !== ')') throw new Error('missing )'); p++; }
    else throw new Error('unexpected token');
  };
  const term = () => { factor(); while (toks[p] === '*' || toks[p] === '/') { const o = BIN[toks[p]]; p++; factor(); code.push({ op: o }); } };
  const expr = () => { term(); while (toks[p] === '+' || toks[p] === '-') { const o = BIN[toks[p]]; p++; term(); code.push({ op: o }); } };
  try { expr(); if (p !== toks.length) throw new Error('trailing tokens'); return { code, err: '' }; }
  catch (e) { return { code: [], err: (e as Error).message }; }
}
const runTo = (code: Ins[], n: number): number[] => {
  const st: number[] = [];
  for (let i = 0; i < n && i < code.length; i++) { const c = code[i]; if (c.op === 'PUSH') st.push(c.arg!); else { const b = st.pop() ?? 0, a = st.pop() ?? 0; st.push(c.op === 'ADD' ? a + b : c.op === 'SUB' ? a - b : c.op === 'MUL' ? a * b : a / b); } }
  return st;
};
const fmt = (c: Ins) => c.op === 'PUSH' ? `PUSH ${c.arg}` : c.op;

type Phase = 'idea' | 'stack' | 'loop' | 'trade' | 'run';
const EXAMPLE = '(2 + 3) * 4';

export function BytecodeSection() {
  const [src, setSrc] = useState(EXAMPLE);
  const [pc, setPc] = useState(0);
  const live = compileBC(src);
  const clampPc = Math.min(pc, live.code.length);

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <VM phase={key} code={compileBC(EXAMPLE).code} pc={compileBC(EXAMPLE).code.length} err="" /> });

  const scenes: StoryScene[] = [
    narrated('idea', 'Compile once, run anywhere', 'Instead of compiling to one CPU’s machine code, a compiler can target a portable bytecode — a made-up instruction set. Then a small program, the virtual machine, interprets it. Python, Java, and WebAssembly all work this way: the same bytecode runs anywhere the VM does.'),
    narrated('stack', 'A stack machine', 'Most bytecode VMs are stack-based — no registers to allocate. Instructions just push and pop an operand stack. PUSH 2 puts 2 on top; ADD pops the top two values and pushes their sum. Compact and easy to generate.'),
    narrated('loop', 'The interpreter loop', 'The VM keeps its own program counter into the bytecode and loops: fetch the opcode at PC, decode it (a big switch), execute it (touch the stack), advance. That is exactly the CPU’s fetch-decode-execute — running in software instead of silicon.'),
    narrated('trade', 'Portable and safe, but slower', '(2 + 3) × 4 becomes PUSH 2 · PUSH 3 · ADD · PUSH 4 · MUL, and the answer is whatever is left on the stack. One bytecode runs on every VM, and the VM can sandbox each instruction — but every step is a fetch and a switch in software, so it is slower than native code. That overhead is why JITs recompile hot bytecode into real machine code.'),
    { key: 'run', title: 'Step the machine yourself', caption: 'Type an arithmetic expression. It is compiled to real bytecode; press step to run the interpreter loop one instruction at a time and watch the operand stack grow and shrink. Whatever remains at the end is the result.', render: () => <VM phase="run" code={live.code} pc={clampPc} err={live.err} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Rather than compile all the way down to one specific CPU’s machine code, many languages compile to a portable bytecode — a made-up instruction set — and ship a small program, the virtual machine, that interprets it. The same bytecode then runs anywhere the VM runs. This runs a real stack-based VM on an expression you type in.</>,
        takeaway: <>Most bytecode VMs are stack machines: instructions push and pop an operand stack (PUSH 3, then ADD pops the top two and pushes their sum), which is compact and trivial for a compiler to generate. The VM keeps its own program counter and loops — fetch the opcode, decode it in one big switch, execute it, advance — which is the CPU’s own fetch-decode-execute cycle, just written in software. That software layer is what buys portability (Python, Java, WebAssembly) and safe sandboxing; the per-instruction overhead is precisely what a JIT later removes by recompiling the hot parts to native code.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <input className="bc-input" value={src} spellCheck={false} onChange={(e) => { setSrc(e.target.value); setPc(0); }} />
          <button type="button" onClick={() => setPc((v) => (v >= live.code.length ? 0 : v + 1))} disabled={!!live.err}>{clampPc >= live.code.length && live.code.length ? '↻ reset' : 'step ▶'}</button>
          <span className="bc-live-note">{live.err ? `✗ ${live.err}` : `PC ${clampPc}/${live.code.length}${clampPc >= live.code.length && live.code.length ? ` · result ${runTo(live.code, live.code.length)[0]}` : ''}`}</span>
        </>
      )}
    />
  );
}

function VM({ phase, code, pc, err }: { phase: Phase; code: Ins[]; pc: number; err: string }) {
  const on = (p: Phase) => phase === p;
  const stack = runTo(code, pc);
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {on('idea') ? (
        <>
          <rect x="120" y="150" width="200" height="60" rx="8" className="bc-src-box" />
          <text x="220" y="186" className="bc-src-txt" textAnchor="middle">your program</text>
          <text x="360" y="186" className="bc-arrow" textAnchor="middle">⟶</text>
          <rect x="400" y="150" width="160" height="60" rx="8" className="bc-bc-box" />
          <text x="480" y="186" className="bc-src-txt" textAnchor="middle">bytecode</text>
          <text x="600" y="186" className="bc-arrow" textAnchor="middle">⟶</text>
          <rect x="640" y="150" width="160" height="60" rx="8" className="bc-vm-box" />
          <text x="720" y="180" className="bc-src-txt" textAnchor="middle">the VM</text>
          <text x="720" y="200" className="bc-src-sub" textAnchor="middle">runs anywhere</text>
          <text x="450" y="270" className="bc-mid" textAnchor="middle">Python · JVM · WebAssembly — compile once, interpret everywhere</text>
        </>
      ) : (
        <>
          {/* interpreter loop badge */}
          {(on('loop') || on('run')) && <text x="450" y="52" className="bc-loop" textAnchor="middle">fetch → decode → execute → advance PC</text>}
          {/* bytecode listing */}
          <text x="90" y="90" className="bc-col-lbl">bytecode</text>
          {code.length === 0 && err && <text x="90" y="130" className="bc-err">✗ {err}</text>}
          {code.map((c, i) => (
            <g key={i}>
              <rect x="70" y={100 + i * 34} width="230" height="28" rx="5" className={`bc-ins ${i === pc && on('run') ? 'cur' : i < pc ? 'done' : ''}`} />
              <text x="86" y={119 + i * 34} className="bc-ins-txt">{String(i).padStart(2, '0')}  {fmt(c)}</text>
            </g>
          ))}
          {/* operand stack */}
          <text x="640" y="90" className="bc-col-lbl" textAnchor="middle">operand stack</text>
          <line x1="560" y1="430" x2="720" y2="430" className="bc-stack-base" />
          {stack.map((v, i) => (
            <g key={i}>
              <rect x="570" y={410 - i * 44} width="140" height="38" rx="5" className={`bc-cell ${i === stack.length - 1 ? 'top' : ''}`} />
              <text x="640" y={434 - i * 44} className="bc-cell-txt" textAnchor="middle">{v}</text>
            </g>
          ))}
          {stack.length === 0 && !err && <text x="640" y="410" className="bc-empty" textAnchor="middle">(empty)</text>}
        </>
      )}
      <text x="450" y="466" className="bc-foot" textAnchor="middle">
        {on('idea') ? 'the VM is the portable “CPU” your bytecode targets'
          : on('stack') ? 'PUSH adds to the top; every operator pops its inputs and pushes the result'
          : on('loop') ? 'a software fetch-decode-execute — one switch statement, run in a loop'
          : on('trade') ? 'portable and sandboxed, but a fetch+switch per op — hence JIT compilation'
          : (err ? 'fix the expression above' : pc >= code.length && code.length ? `done — the result ${stack[0]} is what remains on the stack` : 'step through: watch the stack grow on PUSH and shrink on each operator')}
      </text>
    </svg>
  );
}
