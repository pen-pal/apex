// Offensive-security arc #4: how ASLR randomizes the addresses (and how one leak defeats it) — on the GuidedStory
// engine. ROP hardcodes gadget/libc addresses; ASLR loads libc/stack/heap/PIE at a random base each run, so the stale
// chain jumps into nowhere and crashes. The deep point: everything in libc shifts by the SAME offset, so leaking ONE
// runtime address recovers the base and every function/gadget address with it — ASLR without a leak is strong, with a
// leak is defeated. Conceptual + sandboxed (real fixed libc offsets, illustrative bases). Scenes + a randomize/leak/fire
// interactive. Motivates why modern exploits are two-stage and why info-leak bugs are prized.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const SYS_OFF = 0x4f420, SH_OFF = 0x1b45bd; // system() and "/bin/sh" — fixed offsets inside libc
const STALE_BASE = 0x7f3a00000000;           // the libc base on the run the attacker built the chain
const hex = (n: number) => '0x' + n.toString(16).padStart(12, '0');
const randBase = () => 0x7f0000000000 + (Math.floor(Math.random() * 0xefff) + 1) * 0x100000;

type Phase = 'need' | 'rand' | 'crash' | 'leak' | 'win' | 'run';

export function AslrSection() {
  const [base, setBase] = useState(STALE_BASE);
  const [leaked, setLeaked] = useState(false);
  const [fired, setFired] = useState<null | 'crash' | 'win'>(null);

  const hardcoded = STALE_BASE + SYS_OFF;        // what the ROP chain literally contains
  const target = leaked ? base + SYS_OFF : hardcoded; // leaked → recomputed from the real base

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, b: number, lk: boolean, fr: null | 'crash' | 'win'): StoryScene =>
    ({ key, title, caption, render: () => <Aslr base={b} leaked={lk} target={key === 'win' ? b + SYS_OFF : (lk ? b + SYS_OFF : STALE_BASE + SYS_OFF)} fired={fr} /> });

  const R2 = 0x7f9100000000; // an example re-randomized base for the narrated scenes
  const scenes: StoryScene[] = [
    scene('need', 'ROP needs exact addresses', 'The ROP chain hardcodes addresses — system() at 0x7f3a0004f420, the "/bin/sh" string, each gadget. That only works because you built it on a run where libc sat at exactly that base. What if the base were different every time?', STALE_BASE, false, null),
    scene('rand', 'ASLR randomizes the base', 'ASLR loads libc, the stack, the heap, and (with PIE) the executable itself at a random base address on every run. Run one: libc at 0x7f3a…; run two: libc at 0x7f91…. Every address inside shifts with it, so your hardcoded 0x7f3a0004f420 no longer points at system().', R2, false, null),
    scene('crash', 'The blind chain crashes', 'Fire the old chain anyway: it returns to 0x7f3a0004f420, but this run system() is elsewhere. The CPU lands in the middle of unrelated code or unmapped memory and the program dies. ASLR broke the exploit without fixing the bug.', R2, false, 'crash'),
    scene('leak', 'But everything moved together', 'Here is the hinge: libc is mapped as one block, so system() is ALWAYS at base + 0x4f420, whatever the base is today. Leak a single real libc address at runtime — a format-string %p, an uninitialized read, a pointer in an error message — and you can subtract its known offset to recover the base.', R2, true, null),
    scene('win', 'Recompute, and win', 'With the leaked base you recompute every address: system() = base + 0x4f420, "/bin/sh" = base + offset. Rebuild the chain with the correct runtime addresses and it hits system() exactly. ASLR with no leak is strong; ASLR plus one leaked address is defeated.', R2, true, 'win'),
    { key: 'run', title: 'Randomize, leak, fire', caption: 'Re-run to randomize the base and watch the stale hardcoded chain miss. Fire it blind and it crashes. Then leak a libc address — the base falls out, the chain is recomputed, and it lands on system() every time. Two stages: leak, then exploit.', render: () => <Aslr base={base} leaked={leaked} target={target} fired={fired} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>ROP only works if you know the addresses — where <code>system()</code> lives, where each gadget sits. ASLR (Address Space Layout Randomization) takes that away: on every run the OS loads libc, the stack, the heap, and the executable itself at a different random base. The gadget you hardcoded at <code>0x7f3a0004f420</code> is somewhere else now, so the chain returns into nowhere and crashes — the exploit broke without the bug ever being fixed.</>,
        takeaway: <>ASLR randomizes a handful of base addresses, but everything <em>within</em> a library moves together — <code>system()</code> is always a fixed offset from libc’s base, whatever that base is today. So the whole scheme hinges on one thing: leak a single real runtime address (a format-string <code>%p</code>, an uninitialized read, a pointer in an error message) and subtract the known static offset to recover the base — and from the base, every gadget and function address falls out. ASLR with no leak is strong; ASLR plus one infoleak is defeated. That is why modern exploits are two-stage — leak, then exploit — and why info-leak bugs are prized far beyond their apparent severity. The answer to leaks is the next layer: stack canaries and CFI.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" className="asl-btn" onClick={() => { setBase(randBase()); setLeaked(false); setFired(null); }}>re-run (ASLR)</button>
          <button type="button" className="asl-btn" disabled={leaked} onClick={() => { setLeaked(true); setFired(null); }}>leak an address</button>
          <button type="button" className="asl-btn fire" onClick={() => setFired((base + SYS_OFF === (leaked ? base + SYS_OFF : STALE_BASE + SYS_OFF)) ? 'win' : 'crash')}>fire the chain ▸</button>
          <span className={`asl-live ${fired === 'win' ? 'ok' : fired === 'crash' ? 'bad' : ''}`}>{fired === 'win' ? '● system("/bin/sh") — shell' : fired === 'crash' ? '✗ SIGSEGV — wrong address' : leaked ? 'base leaked — chain recomputed' : 'stale hardcoded chain'}</span>
        </>
      )}
    />
  );
}

function Aslr({ base, leaked, target, fired }: { base: number; leaked: boolean; target: number; fired: null | 'crash' | 'win' }) {
  const actualSys = base + SYS_OFF;
  const hit = target === actualSys;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* libc mapping */}
      <text x="50" y="48" className="asl-col">libc mapping (this run)</text>
      <rect x="50" y="62" width="380" height="150" rx="8" className="asl-libc" />
      <text x="68" y="90" className="asl-row">base <tspan className="asl-addr rand">{hex(base)}</tspan> <tspan className="asl-tag">← randomized each run</tspan></text>
      <line x1="68" y1="102" x2="412" y2="102" className="asl-div" />
      <text x="68" y="128" className="asl-row">+0x4f420  system() <tspan className="asl-addr">{hex(base + SYS_OFF)}</tspan></text>
      <text x="68" y="156" className="asl-row">+0x1b45bd "/bin/sh" <tspan className="asl-addr">{hex(base + SH_OFF)}</tspan></text>
      <text x="68" y="192" className="asl-note">every entry = base + a fixed offset</text>

      {/* the chain's target */}
      <text x="480" y="48" className="asl-col">the ROP chain returns to</text>
      <rect x="480" y="62" width="380" height="86" rx="8" className={`asl-target ${leaked ? 'computed' : 'stale'}`} />
      <text x="498" y="92" className="asl-row">{leaked ? 'base(leaked) + 0x4f420' : 'hardcoded from an old run'}</text>
      <text x="498" y="122" className="asl-addr big">{hex(target)}</text>

      {/* comparison */}
      <text x="670" y="196" className={`asl-cmp ${hit ? 'ok' : 'bad'}`} textAnchor="middle">
        {hit ? '= system() ✓  matches this run' : '≠ system() ✗  points at garbage'}
      </text>

      {/* leak panel */}
      {leaked && (
        <g>
          <rect x="50" y="238" width="810" height="66" rx="8" className="asl-leak" />
          <text x="68" y="266" className="asl-row">leaked a libc pointer: <tspan className="asl-addr">{hex(actualSys)}</tspan>  −  known offset 0x4f420  =  base <tspan className="asl-addr rand">{hex(base)}</tspan></text>
          <text x="68" y="290" className="asl-note">one leak → the base → every gadget and function address</text>
        </g>
      )}

      {/* outcome */}
      {fired && (
        <text x="450" y="360" className={`asl-out ${fired === 'win' ? 'ok' : 'bad'}`} textAnchor="middle">
          {fired === 'win' ? 'chain returns to the real system() → shell spawned' : 'chain returns to a stale address → SIGSEGV, exploit failed'}
        </text>
      )}

      <text x="450" y="452" className="asl-foot" textAnchor="middle">
        {leaked ? 'ASLR + one infoleak = defeated — modern exploits leak first, then exploit'
          : 'ASLR + no leak = the attacker is guessing a 28+ bit address — practically strong'}
      </text>
    </svg>
  );
}
