// Offensive-security arc #3: how ROP bypasses NX — return-oriented programming, on the GuidedStory engine. NX stopped
// injected code, but you still own the stack, and `ret` blindly follows whatever addresses are on it. ROP chains
// "gadgets" — short instruction sequences ending in ret, already sitting in executable memory — to call system('/bin/sh')
// without executing a single injected byte. A step-through of the chain: ret pops each gadget address, the gadget runs,
// its ret pops the next. Conceptual + sandboxed (real x86-64 calling convention; illustrative addresses). Motivates ASLR.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const GADGETS = [
  { asm: 'pop rdi ; ret', addr: '0x4011a3', used: true },
  { asm: 'pop rsi ; ret', addr: '0x4011b0', used: false },
  { asm: 'mov [rax], rbx ; ret', addr: '0x40120c', used: false },
];
const BINSH = '0x7f3ad8e0', SYSTEM = '0x7f3a4520';
// the ROP chain the overflow writes above the saved return slot (lowest address first = consumed first):
const CHAIN = [
  { addr: '0x4011a3', label: '&(pop rdi ; ret)', kind: 'gadget' },
  { addr: BINSH, label: '"/bin/sh" pointer', kind: 'data' },
  { addr: SYSTEM, label: '&system()', kind: 'call' },
];

// step machine: 0 laid out → 1 ret→gadget → 2 pop rdi → 3 ret→system → 4 executed
function frame(step: number) {
  const rspIdx = Math.min(step, 3); // which chain entry RSP points at (3 = past the end)
  const rdi = step >= 2 ? BINSH : '—';
  const pc = step <= 0 ? 'caller — ret next'
    : step <= 2 ? 'pop rdi ; ret   @0x4011a3'
      : 'system   @0x7f3a4520';
  const onGadget = step === 1 || step === 2;
  const msg = [
    'The overflow wrote this chain above the saved return address. RSP points at the first entry, and the function is about to run its ret.',
    'ret pops the first address and jumps to it — the gadget pop rdi ; ret, real code already living in .text. NX is irrelevant: this page is executable.',
    'pop rdi loads the next stack value — the pointer to "/bin/sh" — into rdi, the register that holds a function’s first argument.',
    'The gadget’s own ret pops the next address off the stack: libc’s system(). rdi is already set up from the last step.',
    'system("/bin/sh") runs — a shell. Every instruction executed was already in an executable page, so NX never fired. No injected code ran.',
  ][step];
  return { rspIdx, rdi, pc, onGadget, msg, done: step >= 4 };
}

type Phase = 'left' | 'gadget' | 'chain' | 'call' | 'run';

export function RopSection() {
  const [step, setStep] = useState(0);
  const sceneStep: Record<Exclude<Phase, 'run'>, number> = { left: 0, gadget: 1, chain: 2, call: 3 };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Rop step={sceneStep[key]} /> });

  const scenes: StoryScene[] = [
    scene('left', 'NX left you the stack', 'NX stopped you from running injected code — but you still overflow the stack and control every value on it, and the ret instruction blindly jumps to whatever address it pops. What if the “code” you run is already sitting in memory, on a page that is allowed to execute?'),
    scene('gadget', 'A gadget is borrowed code', 'Scattered through the binary and libc are short instruction sequences that happen to end in ret — pop rdi ; ret, pop rsi ; ret, and thousands more. Each is a gadget: one small operation you can borrow, whose ret then hands control to whatever address is next on the stack.'),
    scene('chain', 'Chain them up the stack', 'Instead of one return address, the overflow writes a list of gadget addresses. The first ret jumps to gadget one; its ret pops and jumps to gadget two; and so on. The stack has become the program, and ret is the program counter walking down it.'),
    scene('call', 'Call system("/bin/sh")', 'A real chain: pop rdi ; ret loads the address of the "/bin/sh" string into rdi (the first-argument register), then the chain returns straight into libc’s system(). The argument is set up and a real function is called — using only code that was already executable.'),
    { key: 'run', title: 'Walk the chain', caption: 'Step the ROP chain one gadget at a time. Watch RSP march down the stack as each ret pops the next address, the gadget execute and set rdi, and finally system() get called. Nothing on a writable page is ever executed — NX is fully bypassed with code that was already there.', render: () => <Rop step={step} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>NX stopped you from running code you inject — but it left you in complete control of the stack, and the stack is full of return addresses that the <code>ret</code> instruction blindly follows. Return-oriented programming turns that into a weapon: rather than inject code, you find short snippets already in the program that end in <code>ret</code> — “gadgets” — and chain them by laying their addresses up the stack. Each gadget does one small thing and its <code>ret</code> jumps to the next. Every instruction executed already lives on an executable page, so NX never fires.</>,
        takeaway: <>A gadget is any useful instruction (or two) immediately followed by <code>ret</code>; a large binary plus libc holds thousands — enough to be Turing-complete. The overflow overwrites the saved return address <em>and</em> writes a list of gadget addresses above it, so <code>ret</code> becomes the program counter, popping the next gadget each time it fires. The classic chain loads the address of <code>"/bin/sh"</code> into the argument register (<code>pop rdi ; ret</code>) and returns into libc’s <code>system()</code> — arbitrary code execution without executing one injected byte. This is why NX alone was not enough, and it is exactly what ASLR (hide the addresses) and control-flow integrity (check where <code>ret</code>s land) were built to stop — the next stories.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" className="rop-btn" onClick={() => setStep((n) => Math.min(4, n + 1))} disabled={step >= 4}>step ▸</button>
          <button type="button" className="rop-btn ghost" onClick={() => setStep(0)}>reset</button>
          <span className="rop-live">{step >= 4 ? '● shell spawned — NX bypassed' : `step ${step}/4`}</span>
        </>
      )}
    />
  );
}

function Rop({ step }: { step: number }) {
  const f = frame(step);
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* gadget catalog */}
      <text x="40" y="46" className="rop-col">gadgets — already in .text / libc</text>
      {GADGETS.map((g, i) => (
        <g key={g.addr}>
          <rect x="40" y={62 + i * 46} width="250" height="38" rx="6" className={`rop-gad ${g.used && f.onGadget ? 'active' : ''} ${g.used ? 'used' : ''}`} />
          <text x="54" y={86 + i * 46} className="rop-gad-asm">{g.asm}</text>
          <text x="278" y={86 + i * 46} className="rop-gad-addr" textAnchor="end">{g.addr}</text>
        </g>
      ))}
      <text x="40" y={62 + 3 * 46 + 22} className="rop-note">…a large binary + libc holds thousands</text>

      {/* the stack / ROP chain */}
      <text x="360" y="46" className="rop-col" textAnchor="middle">the stack — your ROP chain</text>
      {CHAIN.map((c, i) => {
        const consumed = i < f.rspIdx; const cur = i === f.rspIdx;
        return (
          <g key={i}>
            <rect x="330" y={62 + i * 58} width="230" height="48" rx="6" className={`rop-slot ${c.kind} ${consumed ? 'used' : ''} ${cur ? 'cur' : ''}`} />
            <text x="346" y={82 + i * 58} className="rop-slot-addr">{c.addr}</text>
            <text x="346" y={100 + i * 58} className="rop-slot-lbl">{c.label}</text>
            {cur && <text x="300" y={90 + i * 58} className="rop-rsp" textAnchor="end">RSP →</text>}
          </g>
        );
      })}
      {f.rspIdx >= 3 && <text x="300" y={62 + 3 * 58 + 14} className="rop-rsp" textAnchor="end">RSP →</text>}
      <text x="445" y="452" className="rop-foot" textAnchor="middle">ret pops the next address ↓ and jumps to it</text>

      {/* registers + status */}
      <text x="620" y="46" className="rop-col">registers</text>
      <rect x="620" y="60" width="250" height="132" rx="8" className="rop-regs" />
      <text x="638" y="90" className="rop-reg">pc  <tspan className="rop-reg-v">{f.pc}</tspan></text>
      <text x="638" y="120" className="rop-reg">rdi <tspan className={`rop-reg-v ${f.rdi !== '—' ? 'set' : ''}`}>{f.rdi}{f.rdi !== '—' ? '  ("/bin/sh")' : ''}</tspan></text>
      <text x="638" y="150" className="rop-reg">rsp <tspan className="rop-reg-v">{f.rspIdx >= 3 ? 'past chain' : `chain[${f.rspIdx}]`}</tspan></text>
      <text x="638" y="180" className={`rop-reg-note ${f.done ? 'win' : ''}`}>{f.done ? '→ execve("/bin/sh") — shell' : 'NX: every page above is executable'}</text>

      <foreignObject x="600" y="210" width="285" height="230">
        <div className="rop-msg">{f.msg}</div>
      </foreignObject>
    </svg>
  );
}
