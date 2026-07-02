// Offensive-security arc #2: how NX / DEP stops your shellcode — the first mitigation, on the GuidedStory engine.
// Builds on the buffer-overflow story: the overflow still overwrites the return address, but the stack is now marked
// non-executable, so jumping into your shellcode faults. Introduces W^X and the page-table NX bit, and motivates ROP
// (the next story). Conceptual + sandboxed. Scenes: the overflow still works, W^X page permissions, the jump faults,
// the pivot to reusing executable code, then a live NX toggle showing shellcode-runs vs SIGSEGV.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Seg = { name: string; addr: string; r: boolean; w: boolean; code: boolean; note?: string };
// high address (stack) at top → low address (.text) at bottom, the usual memory-map convention
const SEGS: Seg[] = [
  { name: 'stack', addr: '0x7fff…', r: true, w: true, code: false, note: 'your overflow + shellcode land here' },
  { name: 'heap', addr: '0x5555…', r: true, w: true, code: false },
  { name: 'libc', addr: '0x7f21…', r: true, w: false, code: true, note: 'system(), execve() — already executable' },
  { name: '.text (your code)', addr: '0x4011…', r: true, w: false, code: true },
];

type Phase = 'recap' | 'wx' | 'fault' | 'pivot' | 'run';

export function NxSection() {
  const [nx, setNx] = useState(true);

  const scene = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Map phase={key} nx={key === 'recap' ? false : true} /> });

  const scenes: StoryScene[] = [
    scene('recap', 'The overflow still works', 'Straight from the previous story: overflow the buffer, overwrite the saved return address, and point it back at the shellcode you wrote into the buffer. On an old system the CPU returns into the stack and runs your code. So why doesn’t this work today?'),
    scene('wx', 'Every page has an execute bit', 'Physical memory is handed out in pages, and each page-table entry carries permission bits: readable, writable, and — the one that matters here — executable. The rule modern systems enforce is W^X: a page is writable or executable, never both. The stack and heap hold data you write, so they are marked writable and NOT executable; only code pages (.text, libc) are executable.'),
    scene('fault', 'The jump faults', 'The overflow still hijacks the return address — NX changes nothing about that. But the moment the CPU tries to fetch an instruction from your shellcode on the stack, it checks the page’s execute bit, finds it clear, and raises a fault. The program dies with SIGSEGV instead of running your code. Your bytes are right there; the hardware simply refuses to execute them.'),
    scene('pivot', 'So the attack pivots', 'NX did not fix the bug — you still control the return address. It only forbids one thing: running data as code. So attackers stop injecting new code and start reusing code that is already executable — the program’s own functions and all of libc. Point the return address at system() instead of at the stack, and nothing is ever executed from a writable page. That pivot is return-to-libc and ROP, the next story.'),
    { key: 'run', title: 'Toggle NX', caption: 'Flip NX on and off against the same overflow. With NX off (the 1990s), the return into the stack executes your shellcode. With NX on, the identical overflow reaches the identical shellcode — and dies at the execute check on the writable stack page. The bug is unchanged; only the outcome differs.', render: () => <Map phase="run" nx={nx} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The buffer overflow let you write shellcode into the buffer and point the return address at it. NX — the No-eXecute bit, sold as DEP on Windows — shuts exactly that door: every memory page carries an execute permission, and the OS marks the stack and heap writable-but-not-executable. The overflow still overwrites the return address, but the instant the CPU tries to run your bytes on the stack, the hardware faults.</>,
        takeaway: <>The principle is <strong>W^X</strong> (writable xor executable), enforced by one bit in every page-table entry — the same page table from the page-fault story (bit 63, the XD bit, on x86-64). Data pages can’t be code and code pages can’t be written, which kills classic “inject shellcode and jump to it” outright. But look at what it does <em>not</em> fix: you still fully control the return address. So the attack evolves — instead of supplying new code, reuse code already marked executable (the program’s functions and all of libc). That pivot is return-to-libc and return-oriented programming, the next story, and it is why the arms race did not end here.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="nx-toggle"><input type="checkbox" checked={nx} onChange={(e) => setNx(e.target.checked)} /> NX enabled</label>
          <span className={`nx-live ${nx ? 'ok' : 'bad'}`}>{nx ? 'stack is non-executable → shellcode faults (SIGSEGV)' : 'stack is executable → shellcode runs (classic)'}</span>
        </>
      )}
    />
  );
}

function Map({ phase, nx }: { phase: Phase; nx: boolean }) {
  const on = (p: Phase) => phase === p;
  const showPerms = !on('recap');
  const runsOnStack = !nx; // stack executable only when NX off
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="52" className="nx-col">virtual memory map</text>
      {SEGS.map((seg, i) => {
        const y = 74 + i * 78;
        const isStack = seg.name === 'stack';
        const execNow = seg.code || (!nx && !seg.code ? true : false); // code always exec; data exec only if NX off
        return (
          <g key={seg.name}>
            <rect x="60" y={y} width="440" height="64" rx="7" className={`nx-seg ${seg.code ? 'code' : 'data'} ${isStack && (on('fault') || on('run')) ? (runsOnStack ? 'run' : 'fault') : ''}`} />
            <text x="78" y={y + 27} className="nx-seg-name">{seg.name}</text>
            <text x="78" y={y + 47} className="nx-seg-addr">{seg.addr}</text>
            {isStack && <text x="240" y={y + 27} className="nx-seg-sc">◼ shellcode</text>}
            {seg.note && <text x="240" y={y + 47} className="nx-seg-note">{seg.note}</text>}
            {showPerms && (
              <g>
                {['R', 'W', 'X'].map((p, j) => {
                  const active = p === 'R' ? seg.r : p === 'W' ? seg.w : execNow;
                  return <g key={p}>
                    <rect x={520 + j * 40} y={y + 18} width="30" height="28" rx="4" className={`nx-perm ${active ? (p === 'X' ? 'x' : 'on') : 'off'}`} />
                    <text x={535 + j * 40} y={y + 37} className={`nx-perm-t ${active ? 'on' : 'off'}`} textAnchor="middle">{p}</text>
                  </g>;
                })}
              </g>
            )}
          </g>
        );
      })}

      {/* the return / jump */}
      {(on('fault') || on('pivot') || on('run')) && (
        <g>
          <text x="700" y="90" className="nx-cpu">CPU returns to</text>
          <text x="700" y="112" className="nx-cpu-addr">{on('pivot') ? '0x7f21… (libc system)' : '0x7fff… (stack)'}</text>
          <path d={on('pivot') ? 'M700,120 C640,150 560,200 505,220' : 'M700,120 C640,140 560,110 505,106'} className="nx-jump" markerEnd="url(#nx-arr)" fill="none" />
          <text x="700" y="150" className={`nx-outcome ${on('pivot') ? 'pivot' : runsOnStack ? 'ok' : 'bad'}`}>
            {on('pivot') ? '→ executable page ✓ (reused code)' : runsOnStack ? '→ executes ✓' : '→ execute on W page ✗'}
          </text>
        </g>
      )}

      <text x="280" y="452" className="nx-foot" textAnchor="middle">
        {on('recap') ? 'you still control the return address — that never changes'
          : on('wx') ? 'W^X: writable pages (stack/heap) are not executable; only code pages are'
          : on('fault') ? 'fetching an instruction from a non-executable page → SIGSEGV'
          : on('pivot') ? 'aim the return at code that is already executable → NX bypassed'
          : nx ? 'NX on: the jump into the stack faults at the execute check'
            : 'NX off: the stack is executable, so the shellcode runs'}
      </text>
      <defs><marker id="nx-arr" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="nx-arrhead" /></marker></defs>
    </svg>
  );
}
