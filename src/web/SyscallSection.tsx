// Guided story #8: how a syscall crosses into the kernel — the user/kernel privilege boundary, on the GuidedStory
// engine. Your program runs sandboxed in ring 3 and cannot touch hardware; to read a file it must ask the kernel.
// Scenes: the wall, the trap (syscall number + args in registers), the ring 3→0 mode switch to a fixed entry point,
// the kernel doing the privileged work, the return, then a live step-through with the real cost. This is the
// mechanism futex and io_uring exist to avoid paying twice.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Phase = 'wall' | 'trap' | 'switch' | 'work' | 'return';
const STEPS: Phase[] = ['trap', 'switch', 'work', 'return'];

export function SyscallSection() {
  const [i, setI] = useState(-1); // -1 = idle; 0..3 walk the crossing; 4 = done
  const livePhase: Phase = i < 0 || i >= STEPS.length ? 'wall' : STEPS[i];
  const step = () => setI((v) => (v >= STEPS.length ? -1 : v + 1));

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: (a) => <Kernel phase={key} active={a} done={false} /> });

  const scenes: StoryScene[] = [
    narrated('wall', 'The wall', 'Your program runs in user mode — ring 3 — walled off from the hardware, other processes, and the kernel’s memory. It cannot read a disk or send a packet directly. But it needs to read a file. So it has to ask.'),
    narrated('trap', 'The trap', 'It loads the syscall number into a register (read = 0) and the arguments (which file, where to put the bytes, how many) into others, then runs one special instruction — syscall — that deliberately traps into the kernel.'),
    narrated('switch', 'Mode switch', 'The CPU flips from ring 3 to ring 0, saves the program’s registers, and jumps to a single fixed entry point the kernel installed at boot. The program cannot choose where it lands; the kernel decides, which is what keeps the wall intact.'),
    narrated('work', 'The kernel does the work', 'The handler looks up number 0 in the syscall table (sys_read), checks the arguments — is that file descriptor really yours? is the buffer a valid address you own? — then performs the privileged read from disk into your buffer.'),
    narrated('return', 'Return to user mode', 'The kernel puts the result (bytes read) in a register, restores the saved registers, and runs sysret — back to ring 3, resuming right after the syscall, now holding the data. Your program never left its lane; it asked, and the kernel acted.'),
    { key: 'wall', title: 'Step it, and mind the cost', caption: 'Walk one read() across the wall and back. Each crossing is a mode switch that also disturbs caches and the TLB — hundreds of nanoseconds. Cheap once, expensive a million times, which is exactly why io_uring batches them and a futex skips the kernel when it can.', render: (a) => <Kernel phase={livePhase} active={a} done={i >= STEPS.length} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Your program runs walled off in “user mode,” unable to touch the disk, the network, or another process’s memory directly — that isolation is what stops one buggy or malicious app from taking down the whole machine. So to do anything real, it has to ask the kernel, and a system call is the one carefully controlled doorway through the wall. This steps a single read() across into the kernel and back.</>,
        takeaway: <>The program loads a syscall number and arguments into registers and runs one special instruction that traps into the kernel; the CPU switches to privileged mode, jumps to a fixed entry point the kernel installed, validates the arguments, does the privileged work, and returns. The doorway is deliberately narrow and one-way, so user code can <em>request</em> privileged work without ever <em>gaining</em> privilege. Each crossing costs a mode switch of hundreds of nanoseconds — which is exactly why batching syscalls (io_uring) and avoiding them (a futex’s userspace fast path) are worth real engineering effort.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" onClick={step}>{i >= STEPS.length ? '↻ reset' : i < 0 ? 'run read() — step' : `next: ${STEPS[Math.min(i + 1, STEPS.length - 1)] ?? 'done'}`}</button>
          <span className="sc-live">{i < 0 ? 'in user space (ring 3)' : i >= STEPS.length ? 'done — 56 bytes read, back in ring 3' : `${STEPS[i]} · ${i === 0 ? 'ring 3' : i === 3 ? 'returning' : 'ring 0'}`}</span>
        </>
      )}
    />
  );
}

function Kernel({ phase, active, done }: { phase: Phase; active: boolean; done: boolean }) {
  const on = (p: Phase) => phase === p;
  const inKernel = on('switch') || on('work') || on('return');
  const flow = (y1: number, y2: number, cls: string, show: boolean) =>
    show && active ? <line className={`sc-flow ${cls}`} x1={450} y1={y1} x2={450} y2={y2} pathLength={100} /> : null;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* user space band */}
      <rect x="40" y="40" width="820" height="150" rx="10" className={`sc-user ${!inKernel ? 'active' : ''}`} />
      <text x="60" y="64" className="sc-band-lbl user">USER SPACE · ring 3 · your program</text>
      <rect x="70" y="80" width="250" height="90" rx="6" className="sc-prog" />
      <text x="195" y="110" className="sc-prog-lbl" textAnchor="middle">your program</text>
      <text x="195" y="140" className={`sc-code ${on('trap') ? 'hot' : ''}`} textAnchor="middle">read(fd, buf, 56)</text>
      {(on('trap') || on('switch') || on('work') || on('return')) && <>
        <text x="560" y="105" className={`sc-reg ${on('trap') ? 'hot' : ''}`}>rax = 0   (syscall # = read)</text>
        <text x="560" y="130" className="sc-reg">rdi = fd · rsi = buf · rdx = 56</text>
        {(done || on('return')) && <text x="560" y="158" className="sc-reg ok">rax = 56   (bytes read) ✓</text>}
      </>}

      {/* the wall + trap gate */}
      <line x1="40" y1="210" x2="410" y2="210" className="sc-wall" />
      <line x1="490" y1="210" x2="860" y2="210" className="sc-wall" />
      <rect x="410" y="196" width="80" height="28" rx="5" className={`sc-gate ${on('trap') || on('switch') ? 'hot' : ''}`} />
      <text x="450" y="215" className="sc-gate-lbl" textAnchor="middle">syscall</text>
      {flow(180, 240, 'down', on('trap') || on('switch'))}
      {flow(240, 180, 'up', on('return'))}

      {/* kernel space band */}
      <rect x="40" y="230" width="820" height="210" rx="10" className={`sc-kernel ${inKernel ? 'active' : ''}`} />
      <text x="60" y="254" className="sc-band-lbl kernel">KERNEL SPACE · ring 0 · the OS</text>
      {/* syscall table */}
      <rect x="70" y="270" width="210" height="150" rx="6" className={`sc-box ${on('work') ? 'lit' : ''}`} />
      <text x="175" y="292" className="sc-box-lbl" textAnchor="middle">syscall table</text>
      {['0 → sys_read', '1 → sys_write', '2 → sys_open'].map((t, k) => (
        <text key={k} x="90" y={318 + k * 26} className={`sc-tbl ${k === 0 && (on('work') || on('return')) ? 'hot' : ''}`}>{t}</text>
      ))}
      {/* handler */}
      <rect x="330" y="300" width="220" height="80" rx="6" className={`sc-box ${on('work') ? 'lit' : ''}`} />
      <text x="440" y="330" className="sc-box-lbl" textAnchor="middle">sys_read handler</text>
      <text x="440" y="356" className="sc-box-sub" textAnchor="middle">check args · do the read</text>
      {/* disk */}
      <text x="700" y="330" className="sc-disk" textAnchor="middle">💽</text>
      <text x="700" y="368" className="sc-box-sub" textAnchor="middle">disk / hardware</text>
      {on('work') && active && <line className="sc-flow side" x1="550" y1="340" x2="660" y2="335" pathLength={100} />}

      <text x="450" y="466" className="sc-foot" textAnchor="middle">
        {on('wall') ? 'user code is sandboxed — it must ask the kernel for anything privileged'
          : on('trap') ? 'arguments go in registers; one syscall instruction crosses the wall on purpose'
          : on('switch') ? 'ring 3 → ring 0, context saved, jump to the kernel’s fixed entry point'
          : on('work') ? 'look up the number, validate the args, perform the privileged operation'
          : 'result in a register, restore, sysret — back in ring 3 with the data'}
      </text>
    </svg>
  );
}
