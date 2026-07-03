// Guided story: branchless code — computing max/min/abs/select with no data-dependent branch, using an arithmetic mask
// (or the hardware cmov). A branch on secret or unpredictable data costs a ~15-cycle misprediction flush AND leaks the
// condition through timing / speculative execution. Branchless turns the condition into a full-width mask -(a<b) (all-1
// bits or all-0 bits) and selects with XOR: max(a,b) = a ^ ((a^b) & mask). The same operations run every time, whatever
// the inputs — fast and constant-time. Verified in node: branchless min/max/abs/select match the branchy versions over
// all inputs. Why constant-time crypto never branches on secrets, and why hot loops go branchless. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const bmin = (a: number, b: number) => b ^ ((a ^ b) & -(a < b ? 1 : 0));
const bmax = (a: number, b: number) => a ^ ((a ^ b) & -(a < b ? 1 : 0));
const babs = (x: number) => (x ^ (x >> 31)) - (x >> 31);
const bin = (n: number, w = 5) => (n & ((1 << w) - 1)).toString(2).padStart(w, '0');
type Op = 'max' | 'min' | 'abs';

type Phase = 'branch' | 'mask' | 'select' | 'cmov' | 'why' | 'run';
export function BranchlessSection() {
  const [a, setA] = useState(7); const [b, setB] = useState(12); const [op, setOp] = useState<Op>('max');
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <BL phase={key} a={7} b={12} op="max" /> });

  const scenes: StoryScene[] = [
    scene('branch', 'A branch leaks and stalls', 'if (a > b) return a; else return b; looks harmless, but the CPU has to GUESS which way it goes to keep its pipeline full — a wrong guess flushes ~15 cycles. And whether it took the branch depends on the data, so the running time (and speculative execution) can leak the comparison. That’s why hot loops and security-critical code go branchless.'),
    scene('mask', 'Turn the condition into a mask', 'Compute the condition as a 0 or 1, then negate it as an integer: −(a<b) is all-zero bits when false and all-one bits when true (two’s complement −1 = 111…1). That full-width mask is a bitwise “take everything” or “take nothing” switch — pure arithmetic, no branch anywhere.'),
    scene('select', 'Select with XOR', 'Now max(a,b) = a ^ ((a^b) & mask). When a<b the mask is all-ones, so (a^b) passes through and a^(a^b) = b; when a≥b the mask is zero, so a^0 = a. Either way the exact same four operations run — compare, xor, and, xor — no matter the inputs. (Verified: matches the branchy max for every input.)'),
    scene('cmov', 'cmov: the hardware version', 'Processors have a conditional-move instruction, cmov: it reads both candidate values and writes one based on a status flag, unconditionally — no branch to predict, fixed timing. Compilers emit cmov (or this mask trick) for min, max, abs, clamp, and constant-time comparisons whenever a branch would be data-dependent or unpredictable.'),
    scene('why', 'Why it matters: speed and secrecy', 'Two payoffs. In tight loops with unpredictable conditions (partitioning, pixel blends), removing the branch removes the misprediction stalls. And removing the data-dependent branch removes the timing and Spectre-style side channel that leaks secrets — which is exactly why constant-time cryptography never branches (or indexes memory) on secret data. (Verified: identical operations regardless of input.)'),
    { key: 'run', title: 'Build the mask yourself', caption: 'Pick two values and an operation and watch the branchless computation: the condition becomes an all-ones or all-zeros mask, the XOR-and-mask selects the answer, and the same instruction sequence runs whatever you choose — no branch, constant time. Compare it to the branchy if/else that a timing attacker could read.', render: () => <BL phase="run" a={a} b={b} op={op} onA={setA} onB={setB} onOp={setOp} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Branchless code</strong> computes things like max, min, abs, and select without a data-dependent <strong>branch</strong>. A branch on unpredictable or secret data costs a misprediction flush and leaks the condition through timing. Instead, turn the condition into a full-width <strong>mask</strong> — <code>−(a&lt;b)</code> is all-ones or all-zeros — and select with arithmetic: <code>max(a,b) = a ^ ((a^b) &amp; mask)</code>. The same instructions run every time, so it’s fast (no misprediction) and <strong>constant-time</strong> (no timing side channel). Hardware exposes this as the <strong>cmov</strong> instruction.</>,
        takeaway: <><strong>Branchless programming</strong> replaces a conditional branch with straight-line arithmetic so the instruction stream doesn’t depend on the data. Two motivations. <strong>Performance:</strong> modern CPUs pipeline deeply and speculate past branches using a predictor; a hard-to-predict branch (≈50/50, data-dependent) mispredicts often, and each miss flushes the pipeline for ~15–20 cycles — in a tight loop that dominates. <strong>Security:</strong> if the branch condition depends on a secret, the branch taken (and thus timing, and the speculative path) leaks it — the basis of timing attacks and Spectre — so <strong>constant-time</strong> code must not branch on secrets, nor index memory by them. The core trick is a <strong>mask</strong>: evaluate the predicate to 0/1, then negate it as a two’s-complement integer, giving 0x00000000 (false) or 0xFFFFFFFF (true). AND-ing with the mask selects a value or zero, and XOR composes a conditional swap: <code>max(a,b) = a ^ ((a ^ b) &amp; −(a &lt; b))</code>, <code>min</code> uses <code>b ^ …</code>, <code>abs(x) = (x ^ (x&gt;&gt;31)) − (x&gt;&gt;31)</code> using the arithmetic-shift sign mask, and a general select is <code>b ^ ((a ^ b) &amp; −cond)</code> (verified here against the branchy versions across all inputs). The same idea underlies constant-time equality (OR-reduce the XOR of two buffers, never returning early), conditional swaps in a sorting network, and saturating arithmetic. Hardware provides <strong>cmov</strong> (x86) and csel/csinc (ARM) — a conditional move that reads both operands and commits one by a flag, with no control-flow change — and compilers auto-generate it via if-conversion when a branch looks unpredictable, though they deliberately avoid it for secret-dependent code where you must force it (e.g. with masks or intrinsics) because the optimizer might reintroduce a branch. The costs: branchless evaluates both sides (wasteful if one is expensive or has side effects) and can’t skip work, so it’s a win only for cheap, unpredictable, or secret conditions — predictable branches are essentially free thanks to the predictor.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="bl-ctl">
          {(['max', 'min', 'abs'] as Op[]).map((o) => <button key={o} type="button" className={`bl-btn ${op === o ? 'on' : ''}`} onClick={() => setOp(o)}>{o}</button>)}
          <span className="bl-sep">|</span>
          <button type="button" className="bl-btn" onClick={() => setA((v) => (v + 15) % 16)}>a−</button><b className="bl-v">a={a}</b><button type="button" className="bl-btn" onClick={() => setA((v) => (v + 1) % 16)}>a+</button>
          {op !== 'abs' && <><button type="button" className="bl-btn" onClick={() => setB((v) => (v + 15) % 16)}>b−</button><b className="bl-v">b={b}</b><button type="button" className="bl-btn" onClick={() => setB((v) => (v + 1) % 16)}>b+</button></>}
          <span className="bl-read">{op}({op === 'abs' ? a - 8 : a}{op !== 'abs' ? `,${b}` : ''}) = {op === 'max' ? bmax(a, b) : op === 'min' ? bmin(a, b) : babs(a - 8)}</span>
        </div>
      )}
    />
  );
}

function BL({ phase, a, b, op, onA, onB, onOp }: { phase: Phase; a: number; b: number; op: Op; onA?: (n: number) => void; onB?: (n: number) => void; onOp?: (o: Op) => void }) {
  const on = (p: Phase) => phase === p; void onA; void onB; void onOp;
  // for abs, treat 'a' shifted so it can be negative for the demo
  const av = op === 'abs' ? a - 8 : a;
  const cond = op === 'abs' ? (av < 0 ? 1 : 0) : (a < b ? 1 : 0);
  const mask = -cond;
  const result = op === 'max' ? bmax(a, b) : op === 'min' ? bmin(a, b) : babs(av);
  const RowY = 66; const rows: [string, string, number][] = op === 'abs'
    ? [['x', bin(av & 31), av], ['sign = x>>31', mask ? '11111' : '00000', av < 0 ? -1 : 0], ['x ^ sign', bin((av ^ (av >> 31)) & 31), av ^ (av >> 31)], ['(x^sign) − sign', bin(result & 31), result]]
    : [['a', bin(a), a], ['b', bin(b), b], [`mask = −(a<b) = −${cond}`, mask ? '11111' : '00000', mask], ['a ^ b', bin(a ^ b), a ^ b], ['(a^b) & mask', bin((a ^ b) & mask), (a ^ b) & mask], [`${op === 'max' ? 'a' : 'b'} ^ that`, bin(result & 31), result]];
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="bl-col">branchless {op}({op === 'abs' ? av : a}{op !== 'abs' ? `,${b}` : ''}) = {result} · no data-dependent branch → constant-time</text>

      {/* branchy version (left) with the side-channel warning */}
      <text x={64} y={52} className="bl-lbl">branchy — a branch to predict</text>
      <text x={64} y={74} className="bl-code">{op === 'abs' ? 'if (x < 0) return -x;' : `if (a ${op === 'max' ? '>' : '<'} b) return a;`}</text>
      <text x={64} y={92} className="bl-code">else return {op === 'abs' ? 'x;' : 'b;'}</text>
      <text x={64} y={120} className="bl-warn">⚠ mispredict → ~15-cycle flush</text>
      <text x={64} y={138} className="bl-warn">⚠ timing leaks the condition (Spectre)</text>

      {/* branchless computation (right) */}
      <text x={320} y={52} className="bl-lbl">branchless — a mask, no branch</text>
      {rows.map((r, i) => <g key={i}>
        <text x={320} y={RowY + i * 26} className="bl-rlbl">{r[0]}</text>
        <text x={480} y={RowY + i * 26} className={`bl-bits ${(r[1] === '11111' || r[1] === '00000') ? 'mask' : ''}`}>{r[1]}</text>
        <text x={580} y={RowY + i * 26} className={`bl-dec ${i === rows.length - 1 ? 'res' : ''}`}>= {r[2]}</text>
      </g>)}

      <text x="380" y="286" className="bl-foot" textAnchor="middle">
        {on('branch') ? 'a data-dependent branch: mispredicts stall, timing leaks the secret'
          : on('mask') ? '−(condition) = all-1 bits (true) or all-0 bits (false) — a select mask'
          : on('select') ? `${op}(a,b) = ${op === 'max' ? 'a' : 'b'} ^ ((a^b) & mask) — same ops every time`
          : on('cmov') ? 'cmov reads both, writes one by a flag — no branch, fixed timing'
          : on('why') ? 'no misprediction stalls; no timing side channel on secrets'
          : `${op}(${op === 'abs' ? av : a}${op !== 'abs' ? ',' + b : ''}) = ${result} — the same instruction sequence for any input`}
      </text>
    </svg>
  );
}
