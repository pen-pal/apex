// Guided story #17: how a debugger breakpoint works — the 0xCC / INT3 trick, on the GuidedStory engine. Your code
// runs full-speed native instructions; the debugger isn't checking each one. So to stop at a line it patches memory.
// Scenes: the puzzle, overwrite the instruction's first byte with 0xCC (x86 INT3, saving the original), the trap
// (0xCC → SIGTRAP to the tracer), inspect via ptrace, continue (restore the byte, single-step, re-insert 0xCC),
// then a live step through the whole cycle watching the byte flip. Real x86 (INT3 = 0xCC, ptrace, SIGTRAP).
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const CODE = [
  { addr: '0x401130', bytes: '55', asm: 'push rbp' },
  { addr: '0x401131', bytes: '48 89 e5', asm: 'mov rbp, rsp' },
  { addr: '0x401136', bytes: '8b 45 fc', asm: 'mov eax, [rbp-4]', bp: true },
  { addr: '0x401139', bytes: '83 c0 01', asm: 'add eax, 1' },
  { addr: '0x40113c', bytes: '89 45 fc', asm: 'mov [rbp-4], eax' },
];
const BP = 2; // index of the breakpoint instruction

type Phase = 'puzzle' | 'patch' | 'trap' | 'inspect' | 'continue' | 'run';

export function DebuggerSection() {
  const [step, setStep] = useState(0); // 0 patch · 1 trap · 2 inspect · 3 continue · 4 running-again

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Dbg phase={key} step={0} /> });

  const scenes: StoryScene[] = [
    narrated('puzzle', 'How does it stop at a line?', 'You click a line and the debugger halts your program right there. But your code is just native instructions running at full speed on the CPU — the debugger is not inspecting every one, that would be far too slow. So how does it pause at exactly that address?'),
    narrated('patch', 'Overwrite one byte with 0xCC', 'The debugger saves the first byte of the instruction at that address, then overwrites it with 0xCC — the x86 INT3 “breakpoint” opcode, a single byte. Your program’s code in memory is now booby-trapped at that spot; everywhere else runs untouched, full speed.'),
    narrated('trap', 'The trap fires', 'Execution reaches the address and runs 0xCC. INT3 raises a software interrupt; the kernel stops the process and delivers SIGTRAP to the debugger, which attached earlier with ptrace. The program is frozen on exactly that instruction.'),
    narrated('inspect', 'Look around', 'Now that the process is stopped, the debugger uses ptrace to read its registers and memory — so it can show you the current line, local variables, and the call stack. Nothing in your program runs until you continue.'),
    narrated('continue', 'Continue — put the byte back', 'To resume you must run the real instruction, not 0xCC. So the debugger restores the saved original byte, single-steps exactly one instruction, then writes 0xCC back (so the breakpoint still fires next time the line runs) and lets the program go.'),
    { key: 'run', title: 'Step the whole cycle', caption: 'Walk it: set the breakpoint (byte → 0xCC), let it run and trap, inspect, then continue — and watch that one byte flip between 0xCC and the real 0x8b each time.', render: () => <Dbg phase="run" step={step} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" onClick={() => setStep((v) => (v + 1) % 5)}>{['set breakpoint ▶', 'run → trap ▶', 'inspect ▶', 'continue ▶', '↻ again'][step]}</button>
          <span className="dbg-live">{['byte patched to 0xCC', 'INT3 → SIGTRAP, stopped', 'reading registers via ptrace', 'restore · single-step · re-insert', 'running…'][step]}</span>
        </>
      )}
    />
  );
}

function Dbg({ phase, step }: { phase: Phase; step: number }) {
  const on = (p: Phase) => phase === p;
  // resolve display state from either the narrated phase or the interactive step
  const patched = on('run') ? step <= 2 : (on('patch') || on('trap') || on('inspect'));
  const stopped = on('run') ? (step === 1 || step === 2) : (on('trap') || on('inspect'));
  const pcIdx = on('run') ? (step >= 1 && step <= 3 ? BP : -1) : (on('trap') || on('inspect') || on('continue') ? BP : -1);
  const showRegs = on('run') ? step === 2 : on('inspect');
  const restoring = on('run') ? step === 3 : on('continue');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* process memory */}
      <text x="60" y="70" className="dbg-col">process memory (the running code)</text>
      {CODE.map((ins, i) => {
        const isBp = i === BP;
        const bytes = isBp && patched ? 'cc 45 fc' : ins.bytes;
        const asm = isBp && patched ? '(int3 — trap)' : ins.asm;
        const cur = i === pcIdx;
        return (
          <g key={ins.addr}>
            <rect x="50" y={86 + i * 40} width="470" height="34" rx="5" className={`dbg-ins ${cur ? 'cur' : ''} ${isBp ? 'bp' : ''}`} />
            {cur && <text x="36" y={108 + i * 40} className="dbg-pc" textAnchor="middle">▶</text>}
            <text x="66" y={108 + i * 40} className="dbg-addr">{ins.addr}</text>
            <text x="176" y={108 + i * 40} className={`dbg-bytes ${isBp && patched ? 'cc' : ''}`}>{bytes}</text>
            <text x="300" y={108 + i * 40} className="dbg-asm">{asm}</text>
            {isBp && <text x="500" y={108 + i * 40} className="dbg-bp-tag" textAnchor="end">● bp</text>}
          </g>
        );
      })}
      {(on('patch') || (on('run') && step === 0)) && <text x="285" y="300" className="dbg-hint" textAnchor="middle">saved original first byte: 0x8b</text>}
      {restoring && <text x="285" y="300" className="dbg-hint" textAnchor="middle">byte restored 0xCC → 0x8b · single-step · re-insert 0xCC</text>}

      {/* debugger / tracer panel */}
      <rect x="560" y="86" width="300" height="240" rx="10" className={`dbg-panel ${stopped ? 'stopped' : ''}`} />
      <text x="710" y="112" className="dbg-panel-lbl" textAnchor="middle">debugger (ptrace tracer)</text>
      <text x="710" y="150" className={`dbg-status ${stopped ? 'stop' : 'run'}`} textAnchor="middle">
        {stopped ? 'SIGTRAP · stopped' : patched ? 'breakpoint armed · child running' : 'child running'}
      </text>
      {showRegs && <>
        <text x="585" y="188" className="dbg-reg">rip = 0x401136</text>
        <text x="585" y="212" className="dbg-reg">rax = 0x0000002a</text>
        <text x="585" y="236" className="dbg-reg">rbp-4 (i) = 41</text>
        <text x="585" y="266" className="dbg-reg src">→ line 12:  i += 1;</text>
        <text x="585" y="296" className="dbg-reg dim">locals · stack · registers</text>
      </>}
      {!showRegs && <text x="710" y="220" className="dbg-reg dim" textAnchor="middle">{stopped ? 'ready to inspect' : patched ? 'waiting for the trap' : 'no breakpoint yet'}</text>}

      <text x="450" y="452" className="dbg-foot" textAnchor="middle">
        {on('puzzle') ? 'the CPU runs your code at full speed — the debugger must plant a trap, not watch'
          : on('patch') ? 'INT3 (0xCC) is a one-byte instruction, so it fits over any instruction’s first byte'
          : on('trap') ? '0xCC → software interrupt → kernel → SIGTRAP to the tracer'
          : on('inspect') ? 'ptrace lets the tracer read the stopped child’s registers and memory'
          : on('continue') ? 'restore the real byte, step once, re-arm — so the breakpoint survives a loop'
          : ['byte at 0x401136 is now 0xCC', 'hit 0xCC — INT3 trapped the process', 'stopped: inspect registers and memory', 'putting 0x8b back to run the real instruction', 'resumed at full speed until the next hit'][step]}
      </text>
    </svg>
  );
}
