// Offensive-security arc #6 (final mitigation): control-flow integrity + shadow stacks — on the GuidedStory engine.
// NX/ASLR/canaries each guard a secret the attacker can leak; ROP defeats them by reusing code. The root problem is
// that `ret` and indirect `call` blindly jump to whatever address is in memory. A shadow stack keeps a hardware-
// protected second copy of every return address and compares it on `ret` (Intel CET SHSTK); forward-edge CFI/IBT makes
// indirect branches land only on endbr64 targets. Structural, not a leakable check — but not absolute (coarse CFI,
// data-only attacks). Conceptual + sandboxed. Closes the arc: no single mitigation is a wall; security is layers.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

// three nested call frames; the innermost return address (top) is what the next `ret` will use.
const SHADOW = ['0x401250', '0x4011f0', '0x401180']; // protected copies — the real return addresses
const GADGET = '0x7f3a11a3'; // the overflow overwrote the normal-stack top with a ROP gadget address
const normalTop = (overflowed: boolean) => (overflowed ? GADGET : SHADOW[0]);

type Phase = 'root' | 'shadow' | 'overflow' | 'check' | 'edges' | 'run';

export function CfiSection() {
  const [cfi, setCfi] = useState(true);
  const [ret, setRet] = useState(false);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, overflowed: boolean, cfiOn: boolean, didRet: boolean): StoryScene =>
    ({ key, title, caption, render: () => <Cfi phase={key} overflowed={overflowed} cfi={cfiOn} ret={didRet} /> });

  const scenes: StoryScene[] = [
    scene('root', 'The root problem: ret trusts memory', 'NX, ASLR, and canaries each guard a secret you can leak — and ROP beats them by reusing code. But underneath, the CPU’s ret and indirect call simply jump to whatever address sits in memory. If the return address on the stack is a lie, the CPU follows it. What if that jump were checked against where control is actually allowed to go?', false, true, false),
    scene('shadow', 'Keep a second, protected copy', 'A shadow stack does exactly that. Every call pushes the return address to the normal stack AND to a separate, hardware-protected shadow stack (Intel CET). Two copies of every return address — but only one of them lives in memory the overflow can reach.', false, true, false),
    scene('overflow', 'The overflow can’t reach the shadow', 'Run the overflow: it rewrites the return address on the normal stack with a ROP gadget, exactly as before. But the shadow stack is in protected memory a normal write can’t touch — so its copy still holds the real return address. The two now disagree.', true, true, false),
    scene('check', 'ret compares both → ROP dies', 'On ret, the CPU pops the return address from the normal stack and compares it to the shadow copy. They differ, so it raises a control-protection fault (#CP) and the program stops — before jumping to the gadget. Every ret a ROP chain relies on is now checked, so the whole chain collapses at the first hop.', true, true, true),
    scene('edges', 'Two edges, and the real limit', 'That is the backward edge. The forward edge (Intel IBT) makes every indirect call or jump land on an endbr64 “landing pad” the compiler placed at legitimate targets — a gadget in the middle of a function has none, so it faults too. CFI is structural: it constrains where control may flow, with no secret to leak. But it is not absolute — coarse-grained CFI still allows many valid targets, and data-only attacks corrupt data instead of control flow to sidestep it. Security is layers.', true, true, true),
    { key: 'run', title: 'Fire a ROP chain at it', caption: 'Toggle the shadow stack and fire the overwritten ret. With it off, the CPU trusts the normal stack and returns to the gadget — ROP proceeds. With it on, the normal and shadow copies disagree and the CPU faults (#CP) before the gadget runs. No secret is leaked or guessed — the call graph itself is enforced.', render: () => <Cfi phase="run" overflowed cfi={cfi} ret={ret} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>NX, ASLR, and canaries each guard something the attacker can leak or bypass — and ROP defeats them by reusing existing code. The deeper problem is that the CPU’s <code>ret</code> and indirect <code>call</code> blindly jump to whatever address is in memory. Control-Flow Integrity fixes that at the root by constraining <em>where control is allowed to go</em>: a shadow stack keeps a second, hardware-protected copy of every return address and checks it on <code>ret</code>, and forward-edge CFI requires every indirect branch to land on a marked, legitimate target. There is no secret to steal — the call graph itself is enforced.</>,
        takeaway: <>Two edges. Backward: Intel CET’s <strong>shadow stack</strong> (and ARM’s guarded control stack) pushes each return address to a protected region the overflow can’t reach; on <code>ret</code> the CPU compares the normal-stack copy to the shadow copy and faults on any mismatch — which kills ROP, because every overwritten return address disagrees with its shadow. Forward: indirect calls and jumps must land on an <code>endbr64</code> landing pad (Intel IBT) or a compiler-verified target set, so a gadget mid-function is rejected. This is structural, not a check you can leak past — but it isn’t absolute: coarse-grained CFI still allows many valid targets, and data-only attacks corrupt data instead of control flow to sidestep it. That is the lesson of the whole arc — overflow → NX → ROP → ASLR → canary → CFI — no single mitigation is a wall; each raises the cost, defense is layers, and the frontier keeps moving.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="cfi-toggle"><input type="checkbox" checked={cfi} onChange={(e) => { setCfi(e.target.checked); setRet(false); }} /> shadow stack (CET)</label>
          <button type="button" className="cfi-btn" onClick={() => setRet(true)}>ret ▸</button>
          <button type="button" className="cfi-btn ghost" onClick={() => setRet(false)}>reset</button>
          <span className={`cfi-live ${ret ? (cfi ? 'ok' : 'bad') : ''}`}>{!ret ? 'ready' : cfi ? '● #CP fault — ROP blocked' : '✗ returned to gadget — ROP runs'}</span>
        </>
      )}
    />
  );
}

function Cfi({ phase, overflowed, cfi, ret }: { phase: Phase; overflowed: boolean; cfi: boolean; ret: boolean }) {
  const showShadow = phase !== 'root';
  const nTop = normalTop(overflowed);
  const mismatch = nTop !== SHADOW[0];
  const faulted = ret && cfi && mismatch;
  const hijacked = ret && (!cfi) && mismatch;
  const col = (x: number, label: string, cls: string, top: string, protectedCol: boolean) => (
    <g>
      <text x={x + 90} y="70" className="cfi-col" textAnchor="middle">{label}</text>
      {SHADOW.map((_, i) => {
        const val = i === 0 ? top : SHADOW[i];
        const isTop = i === 0;
        const bad = protectedCol ? false : isTop && overflowed;
        return (
          <g key={i}>
            <rect x={x} y={86 + i * 46} width="180" height="38" rx="5" className={`cfi-slot ${cls} ${bad ? 'bad' : ''} ${isTop && ret ? (faulted || hijacked ? (faulted ? 'fault' : 'hit') : '') : ''}`} />
            <text x={x + 14} y={110 + i * 46} className="cfi-addr">{val}</text>
            {isTop && <text x={x + 90} y={86 + i * 46 - 6} className="cfi-toptag" textAnchor="middle">ret uses this ↓</text>}
          </g>
        );
      })}
      {protectedCol && <text x={x + 90} y={86 + 3 * 46 + 6} className="cfi-lock" textAnchor="middle">🔒 protected memory</text>}
    </g>
  );

  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {col(120, 'normal stack', 'normal', nTop, false)}
      {showShadow && col(600, 'shadow stack', 'shadow', SHADOW[0], true)}

      {/* compare arrow */}
      {showShadow && (phase === 'check' || phase === 'edges' || phase === 'run') && (
        <g>
          <line x1="300" y1="105" x2="600" y2="105" className={`cfi-cmp ${mismatch ? 'bad' : 'ok'}`} markerEnd="url(#cfi-arr)" />
          <text x="450" y="96" className={`cfi-cmp-lbl ${mismatch ? 'bad' : 'ok'}`} textAnchor="middle">{mismatch ? 'compare on ret → ≠ differ' : 'compare on ret → = same'}</text>
        </g>
      )}

      {overflowed && phase !== 'run' && phase !== 'check' && phase !== 'edges' && (
        <text x="210" y="70" className="cfi-note" textAnchor="middle">overflow rewrote the top ↓</text>
      )}

      {/* verdict */}
      <text x="450" y="300" className={`cfi-verdict ${faulted ? 'ok' : hijacked ? 'bad' : ''}`} textAnchor="middle">
        {faulted ? 'normal ≠ shadow → control-protection fault (#CP) → ROP blocked'
          : hijacked ? 'no shadow check → CPU returns to the gadget → ROP proceeds'
            : phase === 'root' ? 'the CPU follows whatever return address is in memory'
              : phase === 'shadow' ? 'two copies of every return address — one of them out of reach'
                : phase === 'overflow' ? 'normal stack corrupted; shadow stack still holds the truth'
                  : 'the call graph is enforced, not a secret you can leak'}
      </text>

      <text x="450" y="452" className="cfi-foot" textAnchor="middle">
        {phase === 'edges' ? 'forward edge (endbr64/IBT) + backward edge (shadow stack) — structural, but not absolute'
          : 'overflow → NX → ROP → ASLR → canary → CFI: no single mitigation is a wall — security is layers'}
      </text>
      <defs><marker id="cfi-arr" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="cfi-arrhead" /></marker></defs>
    </svg>
  );
}
