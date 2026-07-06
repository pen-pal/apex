// Guided story #2: how a CPU runs ONE instruction — the fetch → decode → execute → writeback cycle, on the reusable
// GuidedStory engine. Same datapath in every scene; each phase lights up the active unit and flows the bus that
// carries the data. Five narrated scenes walk the cycle; the sixth is live — step a tiny 3-instruction program and
// watch the PC walk it and r1 change. The plain instruction cycle (pipeline/OoO build on it); not a real ISA.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Phase = 'idle' | 'fetch' | 'decode' | 'execute' | 'writeback';
const PROG = ['LOAD  r1, [5]', 'ADD   r1, r2', 'STORE r1, [6]'];
const PHASES: Phase[] = ['fetch', 'decode', 'execute', 'writeback'];

export function CpuCycleSection() {
  const [pc, setPc] = useState(0);
  const [ph, setPh] = useState(-1); // -1 = before fetch; 0..3 = fetch → decode → execute → writeback
  const [r1, setR1] = useState('·');
  const [mem6, setMem6] = useState('·');
  const done = pc > 2;
  const live: Phase = done || ph < 0 ? 'idle' : PHASES[ph];

  // advance the cycle ONE phase at a time, so you watch fetch → decode → execute → writeback for each instruction
  const step = () => {
    if (done) { setPc(0); setPh(-1); setR1('·'); setMem6('·'); return; }
    const nx = ph + 1;
    if (nx <= 3) {
      setPh(nx);
      if (PHASES[nx] === 'writeback') { // the result is saved back on writeback
        if (pc === 0) setR1('10');
        else if (pc === 1) setR1((v) => String(Number(v) + 3));
        else if (pc === 2) setMem6(r1);
      }
    } else { setPc((p) => p + 1); setPh(-1); } // instruction complete → on to the next
  };

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: (a) => <Datapath phase={key} pc={0} r1="·" mem6="·" active={a} /> });

  const scenes: StoryScene[] = [
    narrated('idle', 'The instruction cycle', 'A CPU does one thing, forever: fetch an instruction, work out what it means, do it, save the result — then move on. Here is a tiny program in memory and the datapath that runs it.'),
    narrated('fetch', 'Fetch', 'The program counter (PC) holds the address of the next instruction. Fetch sends it down the address bus and copies that memory word into the instruction register (IR).'),
    narrated('decode', 'Decode', 'The control unit splits the bits: an opcode (LOAD / ADD / STORE — what to do) and operands (which registers). It wires up the datapath to match.'),
    narrated('execute', 'Execute', 'The register file drives the operands into the ALU, which does the arithmetic or logic — a sum for ADD, an address for LOAD.'),
    narrated('writeback', 'Writeback, then repeat', 'The result goes back to a register or memory, and the PC advances. Repeat this loop billions of times a second and you have a running program.'),
    { key: 'run', title: 'Run it yourself', caption: 'Now drive the cycle by hand, one phase at a time. Click through fetch → decode → execute → writeback and watch the datapath light up each unit — the PC walks 0 → 1 → 2, r1 fills from memory then takes the sum, and the store lands in memory[6]. Three instructions, four phases each: this is a CPU running a program, and the whole of computing is this loop, repeated.', render: (a) => <Datapath phase={live} pc={done ? 2 : pc} r1={r1} mem6={mem6} active={a} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A CPU has no concept of a “program.” It only repeats one loop, forever: read the next instruction from memory — which is just <strong>bytes</strong>, like everything else, read now as a command — work out what it means, do it, save the result, and move to the next. A program counter holds the address of the next instruction; every app, game, and operating system is this loop run billions of times a second. The story walks a single instruction through the datapath — memory, registers, ALU — then lets you run a tiny three-instruction program by hand.</>,
        takeaway: <>Fetch → decode → execute → writeback, one step per stage, with the program counter advancing to thread them together. A processor goes faster two ways: raising the clock (more loops per second), and overlapping the stages so several instructions are in flight at once — that overlap is <em>pipelining</em>, its own story. The key thing to hold onto is that there is nothing beneath this loop; it is the floor that everything else in computing is built on.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" onClick={step}>
            {done ? '↻ reset'
              : ph < 0 ? `▶ fetch — PC ${pc}: ${PROG[pc].trim()}`
              : ph < 3 ? `→ ${PHASES[ph + 1]}`
              : '→ next instruction'}
          </button>
          <span className="cpu-live-state">
            {done ? 'program done · r1 = 13 · mem[6] = 13'
              : ph < 0 ? `PC = ${pc} · ready to fetch`
              : `PC ${pc} · ${live}${r1 !== '·' ? ` · r1=${r1}` : ''}${mem6 !== '·' ? ` · mem[6]=${mem6}` : ''}`}
          </span>
        </>
      )}
    />
  );
}

function Datapath({ phase, pc, r1, mem6, active }: { phase: Phase; pc: number; r1: string; mem6: string; active: boolean }) {
  const on = (p: Phase) => phase === p;
  const mem: Record<number, string> = { 0: PROG[0], 1: PROG[1], 2: PROG[2], 5: '10', 6: mem6 };
  const flow = (cls: string, x1: number, y1: number, x2: number, y2: number, show: boolean) =>
    show && active ? <line className={`cpu-flow ${cls}`} x1={x1} y1={y1} x2={x2} y2={y2} pathLength={100} /> : null;
  const regs: Record<string, string> = { r1, r2: '3', r3: '·', r4: '·' };
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="105" y="40" className="cpu-lbl big" textAnchor="middle">memory</text>
      {[0, 1, 2, 3, 4, 5, 6].map((a) => (
        <g key={a}>
          <rect x="30" y={54 + a * 50} width="150" height="44" rx="4" className={`cpu-mem ${a === pc && on('fetch') ? 'hot' : a <= 2 ? 'code' : a >= 5 ? 'data' : ''}`} />
          <text x="42" y={81 + a * 50} className="cpu-addr">{a}</text>
          <text x="70" y={81 + a * 50} className="cpu-mval">{mem[a] ?? ''}</text>
        </g>
      ))}
      <rect x="250" y="30" width="620" height="420" rx="12" className="cpu-box" />
      <text x="560" y="24" className="cpu-lbl big" textAnchor="middle">CPU</text>
      <rect x="280" y="60" width="120" height="46" rx="5" className={`cpu-unit ${on('writeback') ? 'hot' : on('idle') || on('fetch') ? 'lit' : ''}`} />
      <text x="340" y="82" className="cpu-unit-lbl" textAnchor="middle">PC</text>
      <text x="340" y="99" className="cpu-unit-val" textAnchor="middle">{on('writeback') ? `${pc} → ${pc + 1}` : pc}</text>
      <rect x="280" y="140" width="230" height="46" rx="5" className={`cpu-unit ${on('fetch') ? 'hot' : on('decode') ? 'lit' : ''}`} />
      <text x="395" y="162" className="cpu-unit-lbl" textAnchor="middle">instruction register</text>
      <text x="395" y="179" className="cpu-unit-val" textAnchor="middle">{phase === 'idle' ? '—' : PROG[pc].trim()}</text>
      <rect x="280" y="220" width="230" height="46" rx="5" className={`cpu-unit ${on('decode') ? 'hot' : ''}`} />
      <text x="395" y="242" className="cpu-unit-lbl" textAnchor="middle">control unit</text>
      <text x="395" y="259" className="cpu-unit-val" textAnchor="middle">{on('decode') || on('execute') || on('writeback') ? 'opcode + operands' : ''}</text>
      <rect x="600" y="72" width="150" height="150" rx="6" className={`cpu-unit ${on('execute') || on('writeback') ? 'lit' : ''}`} />
      <text x="675" y="62" className="cpu-lbl" textAnchor="middle">registers</text>
      {['r1', 'r2', 'r3', 'r4'].map((r, i) => (
        <g key={r}>
          <text x="618" y={104 + i * 33} className="cpu-reg-name">{r}</text>
          <text x="732" y={104 + i * 33} className={`cpu-reg-val ${on('writeback') && r === 'r1' ? 'hot' : ''}`} textAnchor="end">{regs[r]}</text>
        </g>
      ))}
      <path d="M600 322 L750 322 L720 408 L630 408 Z" className={`cpu-alu ${on('execute') ? 'hot' : ''}`} />
      <text x="675" y="373" className="cpu-unit-lbl" textAnchor="middle">ALU</text>
      {/* buses */}
      <line x1="280" y1="83" x2="180" y2={76 + pc * 50} className="cpu-bus" />
      <line x1="180" y1={76 + pc * 50} x2="280" y2="163" className="cpu-bus" />
      <line x1="395" y1="186" x2="395" y2="220" className="cpu-bus" />
      <line x1="675" y1="222" x2="675" y2="322" className="cpu-bus" />
      <line x1="600" y1="365" x2="510" y2="365" className="cpu-bus" />
      <line x1="510" y1="365" x2="510" y2="243" className="cpu-bus" />
      {flow('addr', 280, 83, 180, 76 + pc * 50, on('fetch'))}
      {flow('data', 180, 76 + pc * 50, 280, 163, on('fetch'))}
      {flow('dec', 395, 186, 395, 220, on('decode'))}
      {flow('op', 675, 222, 675, 322, on('execute'))}
      {flow('res', 675, 322, 675, 222, on('writeback'))}
      <text x="470" y="474" className="cpu-lbl dim" textAnchor="middle">
        {on('idle') ? 'fetch → decode → execute → writeback, then the PC moves on'
          : on('fetch') ? 'PC → address bus → memory → instruction register'
          : on('decode') ? 'the control unit reads the opcode and wires the datapath'
          : on('execute') ? 'registers → ALU → result'
          : 'result → register, and PC advances'}
      </text>
    </svg>
  );
}
