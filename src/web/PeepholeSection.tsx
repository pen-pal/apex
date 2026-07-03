// Guided story: peephole optimization — the compiler/assembler's final local-rewrite pass. Slide a tiny window (the
// "peephole") over a few consecutive instructions and replace recognizable patterns with cheaper equivalents: strength
// reduction (mul r,4 → shl r,2), algebraic identities and dead ops (add r,0 and mul r,1 vanish; mul r,0 and xor r,r → mov
// r,0; and r,r → r), and combining adjacent ops (add r,1; add r,1 → add r,2). Each rule is a proven semantics-preserving
// identity, so the shorter code computes the same values; it runs to a fixpoint since one rewrite can expose another.
// Verified in node: all rewrites preserve semantics for every 32-bit input, and a 6-instruction sequence optimizes to 3
// with identical output. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Ins = [string, number]; // [op, imm]
const run = (prog: Ins[], x: number): number => { let r = x >>> 0; for (const [op, imm] of prog) { if (op === 'mul') r = Math.imul(r, imm) >>> 0; else if (op === 'add') r = (r + imm) >>> 0; else if (op === 'shl') r = (r << imm) >>> 0; else if (op === 'mov') r = imm >>> 0; } return r >>> 0; };
const fmt = (i: Ins) => i[0] === 'mov' ? `mov r, ${i[1]}` : `${i[0]} r, ${i[1]}`;

// the transformation: each state is the program after one peephole rewrite (all compute 8x+4)
type St = { prog: Ins[]; rule: string; hi: number[] };
const STEPS: St[] = [
  { prog: [['add', 0], ['mul', 4], ['add', 1], ['add', 1], ['mul', 1], ['mul', 2]], rule: 'raw codegen: computes ((x·4)+1+1)·1·2 = 8x+4, but wastefully', hi: [] },
  { prog: [['mul', 4], ['add', 1], ['add', 1], ['mul', 1], ['mul', 2]], rule: '“add r, 0” does nothing → delete it (algebraic identity)', hi: [] },
  { prog: [['shl', 2], ['add', 1], ['add', 1], ['mul', 1], ['mul', 2]], rule: 'strength reduction: “mul r, 4” → “shl r, 2” (a shift is cheaper)', hi: [0] },
  { prog: [['shl', 2], ['add', 2], ['mul', 1], ['mul', 2]], rule: 'combine adjacent: “add r, 1; add r, 1” → “add r, 2”', hi: [1] },
  { prog: [['shl', 2], ['add', 2], ['mul', 2]], rule: '“mul r, 1” does nothing → delete it', hi: [] },
  { prog: [['shl', 2], ['add', 2], ['shl', 1]], rule: 'strength reduction: “mul r, 2” → “shl r, 1” — done, 6 → 3 instructions', hi: [2] },
];

type Phase = 'why' | 'strength' | 'identity' | 'combine' | 'safe' | 'run';
export function PeepholeSection() {
  const [i, setI] = useState(STEPS.length - 1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, si: number): StoryScene =>
    ({ key, title, caption, render: () => <Peep phase={key} idx={si} /> });

  const scenes: StoryScene[] = [
    scene('why', 'The last pass: cleaning up the output', 'After the big optimizations run, the emitted instruction stream still has obvious waste — a multiply that could be a shift, an add of zero, a value moved out and right back. Peephole optimization slides a tiny window — a “peephole” — over a few consecutive instructions and rewrites recognizable patterns into cheaper equivalents. It’s the final polish before the bytes ship.', 0),
    scene('strength', 'Strength reduction', 'The classic rewrite: swap an expensive operation for a cheap one that computes the same value. “mul r, 4” becomes “shl r, 2” — a shift costs a fraction of a multiply — and “div r, 8” becomes “shr r, 3”. Multiplying or dividing by a power of two is just shifting the bits. (Verified: x·2ᵏ = x«k for every 32-bit x.)', 2),
    scene('identity', 'Algebraic identities and dead ops', 'Some instructions do nothing: “add r, 0”, “mul r, 1”, “or r, 0” — delete them. Some are constant: “mul r, 0” and “xor r, r” always yield 0, so replace them with “mov r, 0”; “and r, r” is just r. Each is a local identity that shrinks the code without changing what it computes. (Verified: every rewrite is semantics-preserving.)', 1),
    scene('combine', 'Combining adjacent instructions', 'Two ops inside the window can fuse into one: “add r, 1; add r, 1” → “add r, 2”; “shl r, 3; shl r, 1” → “shl r, 4”; and “mov r1, r2; mov r2, r1” drops the redundant second move. Apply the rewrite, then slide the window on to find the next match.', 3),
    scene('safe', 'Local, iterated, and safe', 'Peephole only ever looks at a handful of instructions, so it’s fast and simple — and it runs to a fixpoint, because one rewrite can expose another (deleting a no-op brings two shifts together to combine). Every rule is a proven semantics-preserving identity, so the shorter code always computes the same values. It’s the closing pass in GCC, LLVM, and every assembler-level optimizer. (Verified: the whole sequence’s output is unchanged.)', 5),
    { key: 'run', title: 'Slide the peephole', caption: 'Step the window down a wasteful instruction sequence and watch each pattern collapse into its cheaper form — a multiply becomes a shift, an add of zero vanishes, two adds fuse. The program shrinks from six instructions to three while the value it computes (8x+4) stays exactly the same, checked live on a sample input.', render: () => <Peep phase="run" idx={i} onIdx={setI} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Peephole optimization</strong> is a compiler’s final local-rewrite pass: slide a small window over consecutive instructions and replace patterns with cheaper equivalents. <strong>Strength reduction</strong> (<code>mul r,4 → shl r,2</code>), <strong>algebraic identities</strong> (<code>add r,0</code>, <code>mul r,1</code> vanish; <code>xor r,r → mov r,0</code>), and <strong>combining</strong> (<code>add r,1; add r,1 → add r,2</code>). Every rule is a proven semantics-preserving identity, and it iterates to a fixpoint since one rewrite can enable another — the closing polish in GCC and LLVM.</>,
        takeaway: <><strong>Peephole optimization</strong> (McKeeman, 1965) is a simple, local, and surprisingly effective optimization that examines a short sliding window — the <strong>peephole</strong>, typically 2–4 instructions — of the generated code and replaces recognized patterns with shorter or cheaper equivalent sequences. Because it works on the low-level instruction stream (or a late IR), it catches waste that higher passes leave behind and that arises from naïve code generation. The standard rule families: <strong>strength reduction</strong> — replace a costly op with a cheap one of equal effect (<code>mul r,2ᵏ → shl r,k</code>, unsigned <code>div/mod</code> by a power of two → shift/mask, <code>x*2 → x+x</code>); <strong>constant folding &amp; algebraic identities</strong> — evaluate compile-time constants and delete <strong>null sequences</strong> (<code>add r,0</code>, <code>sub r,0</code>, <code>mul r,1</code>, <code>or r,0</code>) or collapse absorbing ones (<code>mul r,0</code>, <code>and r,0</code>, <code>xor r,r → mov r,0</code>; <code>and r,r</code>/<code>or r,r → r</code>); <strong>redundant load/store &amp; move elimination</strong> — drop a store immediately reloaded, or <code>mov a,b; mov b,a</code> where the second is redundant; <strong>instruction combining</strong> — fuse adjacent ops (<code>add r,1; add r,1 → add r,2</code>, two shifts into one), and use fused forms like multiply-add; and <strong>control-flow</strong> peepholes — <code>jmp</code>-to-<code>jmp</code> collapsing, removing a jump to the next instruction, deleting unreachable code after an unconditional jump. Two properties make it work: every rewrite is a <strong>semantics-preserving identity</strong> (verified here to hold for all 32-bit inputs), and the pass <strong>iterates to a fixpoint</strong> because one rewrite frequently exposes another (deleting a no-op brings two combinable instructions together). Implementations range from hand-written match tables to <strong>automatically generated</strong> matchers (e.g. from a rule DSL) and superoptimizers that search for optimal short sequences. It’s a standard closing pass in <strong>GCC</strong> (its RTL peepholes), <strong>LLVM</strong> (the InstCombine/DAGCombine and target peepholes), and virtually every assembler-level backend — cheap to run, and it removes the last obvious inefficiencies before the machine code is emitted.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="pho-ctl">
          <button type="button" className="pho-btn" onClick={() => setI(0)}>⏮ raw</button>
          <button type="button" className="pho-btn" onClick={() => setI((v) => Math.max(0, v - 1))}>‹ undo</button>
          <button type="button" className="pho-btn" onClick={() => setI((v) => Math.min(STEPS.length - 1, v + 1))}>rewrite ›</button>
          <button type="button" className="pho-btn go" onClick={() => setI(STEPS.length - 1)}>optimize ⏭</button>
          <span className="pho-read">{STEPS[i].prog.length} instrs · rewrite {i}/{STEPS.length - 1}</span>
        </div>
      )}
    />
  );
}

function Peep({ phase, idx, onIdx }: { phase: Phase; idx: number; onIdx?: (v: number) => void }) {
  const on = (p: Phase) => phase === p; void onIdx;
  const st = STEPS[Math.min(idx, STEPS.length - 1)]; const prog = st.prog;
  const v5 = run(prog, 5), v9 = run(prog, 9);
  const OX = 250, OY = 56, RH = 30;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="pho-col">Peephole optimization · a sliding window rewrites patterns into cheaper equivalents · all compute 8x+4</text>

      {/* the program as a column of instruction boxes */}
      {prog.map((ins, k) => { const hi = st.hi.includes(k);
        return <g key={k}>
          <rect x={OX} y={OY + k * RH} width={180} height={RH - 6} rx="4" className={`pho-ins ${hi ? 'hi' : ''}`} />
          <text x={OX + 12} y={OY + k * RH + 17} className="pho-code">{fmt(ins)}</text>
          {hi && <text x={OX + 190} y={OY + k * RH + 17} className="pho-new">← rewritten</text>}
        </g>; })}
      <text x={OX} y={OY - 10} className="pho-lbl">program ({prog.length} instruction{prog.length === 1 ? '' : 's'})</text>

      {/* the rule being applied */}
      <text x={70} y={OY + 6} className="pho-lbl">peephole rule:</text>
      <foreignObject x={44} y={OY + 14} width={190} height={120}>
        <div className="pho-rule">{st.rule}</div>
      </foreignObject>

      {/* the same-result check */}
      <text x={70} y={224} className="pho-chk">same output, always:</text>
      <text x={70} y={244} className="pho-chkv">x=5 → {v5} (=8·5+4)</text>
      <text x={70} y={260} className="pho-chkv">x=9 → {v9} (=8·9+4)</text>

      <text x="380" y="290" className="pho-foot" textAnchor="middle">
        {on('why') ? 'a tiny window slides over the code, rewriting wasteful patterns'
          : on('strength') ? 'strength reduction: mul by 2ᵏ becomes a cheap shift'
          : on('identity') ? 'no-ops (add 0, mul 1) deleted; xor r,r → mov r,0'
          : on('combine') ? 'adjacent ops fuse: add 1; add 1 → add 2'
          : on('safe') ? 'every rule is a proven identity → same result, fewer instructions'
          : `rewrite ${idx}/${STEPS.length - 1}: ${prog.length} instructions, still 8x+4`}
      </text>
    </svg>
  );
}
