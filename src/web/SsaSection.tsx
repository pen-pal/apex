// Guided story: SSA (Static Single Assignment) form — the compiler IR where every variable is assigned exactly once.
// Reassignments become fresh versions (x → x1, x2, …), so every use names exactly one definition. At control-flow joins,
// a φ (phi) node selects the version from whichever predecessor actually executed: x4 = φ(x2, x3). φ isn't real code — it's
// a marker the compiler resolves — but it keeps single-assignment true across branches, and φ nodes are placed minimally
// at dominance frontiers (Cytron's algorithm). One definition per use makes constant propagation, dead-code elimination,
// value numbering, and register allocation read straight off the graph — which is why LLVM, GCC, V8, and the JVM all
// optimize in SSA. Verified in node: the SSA form matches the mutable original for all inputs on both branches, each
// version is assigned once, φ picks the executed predecessor, and const-prop folds. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const orig = (n: number) => { let x = n; if (x < 5) x = x + 10; else x = x * 2; return x; };

type Phase = 'why' | 'rename' | 'phi' | 'frontier' | 'opt' | 'run';
export function SsaSection() {
  const [n, setN] = useState(3);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Cfg phase={key} n={3} /> });

  const scenes: StoryScene[] = [
    scene('why', 'One name, many values', 'Optimizers dislike mutable variables: when x is assigned three times, answering “which x does this use refer to?” takes analysis. Static Single Assignment rewrites the code so every variable is assigned EXACTLY once — each reassignment becomes a fresh version x₁, x₂, x₃ — so every use points to exactly one definition. That single fact is what most optimizations stand on.'),
    scene('rename', 'Version as you go', 'Walk the code renaming: each assignment to x creates the next version, and each use takes the current one. x = x + 1 becomes x₂ = x₁ + 1. Along a straight run of code the def-use links are now explicit and local — no aliasing, no “did something else change x?” to chase down.'),
    scene('phi', 'Branches meet: the φ node', 'After an if/else, two versions of x reach the join — x₂ from the then-side, x₃ from the else. Which continues? SSA inserts a φ-function: x₄ = φ(x₂, x₃) takes the value from whichever predecessor actually ran. φ isn’t a real instruction — it’s a marker the compiler later lowers to a move or a register — but it keeps single-assignment true across control flow. (Verified: SSA matches the original on both paths.)'),
    scene('frontier', 'Where φ goes: dominance frontiers', 'You don’t drop a φ everywhere — only where two different definitions of a variable can first meet, which is precisely the dominance frontier of each definition. That minimal placement (Cytron’s 1991 algorithm) is what makes SSA cheap to build and keeps the number of φ nodes small.'),
    scene('opt', 'Why SSA runs the compiler', 'With one definition per use, optimizations get easy: constant propagation flows a constant straight down its uses; dead-code elimination drops any value nothing reads; common-subexpression elimination and register allocation read def-use directly off the graph. LLVM, GCC, V8, and the JVM all optimize in SSA. (Verified: single-assignment holds; const-prop folds.)'),
    { key: 'run', title: 'Follow a value through φ', caption: 'Pick the input and watch the branch light up: the taken block computes its version, and the φ at the merge selects exactly that version to continue into the return — the same answer the mutable original gives, but now every value has one definition. That is the property every optimization pass relies on.', render: () => <Cfg phase="run" n={n} onN={setN} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>SSA (Static Single Assignment)</strong> is the intermediate form where every variable is assigned <strong>exactly once</strong>. Reassignments become versions (x → x₁, x₂), so every use refers to one definition. At a control-flow join, a <strong>φ (phi) node</strong> — <code>x₄ = φ(x₂, x₃)</code> — selects the version from whichever predecessor ran, keeping single-assignment true across branches. One-def-per-use makes constant propagation, dead-code elimination, and register allocation read straight off the graph, which is why <strong>LLVM, GCC, V8, and the JVM</strong> all optimize in SSA.</>,
        takeaway: <><strong>Static Single Assignment form</strong> (Cytron, Ferrante, Rosen, Wegman &amp; Zadeck, 1991) is the dominant intermediate representation in modern optimizing compilers. The rule: rewrite the program so each variable name is the target of <strong>exactly one assignment</strong>. A straight-line reassignment <code>x = x + 1</code> becomes <code>x₂ = x₁ + 1</code>; now the <strong>def-use chain</strong> is explicit — every use syntactically names its single defining instruction, so an optimizer never has to ask “which assignment does this read see?” The problem is control flow: at a block with multiple predecessors, different versions of x arrive on different edges. SSA resolves this with a <strong>φ-function</strong> at the top of the join block, <code>x₃ = φ(x₁, x₂)</code>, which conceptually selects the operand corresponding to the incoming edge actually taken. φ is a <strong>notional</strong> instruction (it can’t be executed directly since it depends on control history) and is <strong>lowered</strong> out of SSA before codegen — each φ becomes copies inserted on the predecessor edges (with care for the “swap/lost-copy” problems). φ-nodes are not sprinkled everywhere: a definition needs a φ exactly at its <strong>dominance frontier</strong> — the blocks where that definition stops dominating and could collide with another — and the classic algorithm computes frontiers and does <strong>minimal</strong> φ placement in near-linear time. Loops fit naturally: the loop header gets a φ merging the pre-loop value with the back-edge value. Why it matters: with one definition per use, dataflow becomes almost trivial — <strong>constant propagation</strong> and <strong>copy propagation</strong> flow values along def-use edges, <strong>dead-code elimination</strong> deletes any definition with no uses, <strong>global value numbering</strong> and <strong>common-subexpression elimination</strong> compare definitions directly, and <strong>register allocation</strong> gets clean live ranges (SSA’s interference graphs are chordal, enabling optimal-coloring allocators). Variants like <strong>pruned</strong> and <strong>semi-pruned</strong> SSA cut dead φ’s, and <strong>memory SSA</strong> extends the idea to loads/stores. Essentially every serious compiler — <strong>LLVM</strong> (SSA throughout), <strong>GCC</strong> (GIMPLE-SSA), <strong>V8</strong>/TurboFan, HotSpot’s <strong>JVM</strong> C2, and WebKit — builds SSA, optimizes in it, and lowers φ’s away at the end.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="ssa-ctl">
          <span className="ssa-lab">input n =</span>
          <button type="button" className="ssa-btn" onClick={() => setN((v) => Math.max(0, v - 1))}>−</button>
          <b className="ssa-v">{n}</b>
          <button type="button" className="ssa-btn" onClick={() => setN((v) => Math.min(12, v + 1))}>+</button>
          <span className="ssa-read">branch: {n < 5 ? 'then (n<5)' : 'else (n≥5)'} · φ selects {n < 5 ? 'x₂' : 'x₃'} · return {orig(n)}</span>
        </div>
      )}
    />
  );
}

function Cfg({ phase, n, onN }: { phase: Phase; n: number; onN?: (v: number) => void }) {
  const on = (p: Phase) => phase === p; void onN;
  const x1 = n, x2 = n + 10, x3 = n * 2, took = n < 5 ? 'then' : 'else', x4 = took === 'then' ? x2 : x3;
  const thenOn = took === 'then', elseOn = took === 'else';
  const E = (a: boolean) => a ? 'ssa-edge on' : 'ssa-edge';
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="18" className="ssa-col">SSA · original: x reassigned, x&lt;5? x+10 : x×2 · every version assigned once · φ merges branches</text>

      {/* edges */}
      <path d="M 340 78 L 210 118" className={E(thenOn)} markerEnd="url(#ssaArrow)" />
      <path d="M 420 78 L 552 118" className={E(elseOn)} markerEnd="url(#ssaArrow)" />
      <path d="M 210 168 L 330 214" className={E(thenOn)} markerEnd="url(#ssaArrow)" />
      <path d="M 552 168 L 432 214" className={E(elseOn)} markerEnd="url(#ssaArrow)" />
      <defs><marker id="ssaArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" className="ssa-ah" /></marker></defs>

      {/* entry */}
      <rect x="288" y="38" width="184" height="40" rx="5" className="ssa-blk entry" />
      <text x="380" y="55" className="ssa-bt" textAnchor="middle">entry</text>
      <text x="380" y="71" className="ssa-code" textAnchor="middle">x₁ = n = {x1}</text>

      {/* then */}
      <rect x="96" y="120" width="228" height="48" rx="5" className={`ssa-blk ${thenOn ? 'taken' : ''}`} />
      <text x="110" y="138" className="ssa-bt">then (x₁ &lt; 5)</text>
      <text x="110" y="158" className="ssa-code">x₂ = x₁ + 10 = {x2}</text>

      {/* else */}
      <rect x="438" y="120" width="228" height="48" rx="5" className={`ssa-blk ${elseOn ? 'taken' : ''}`} />
      <text x="452" y="138" className="ssa-bt">else (x₁ ≥ 5)</text>
      <text x="452" y="158" className="ssa-code">x₃ = x₁ × 2 = {x3}</text>

      {/* merge with phi */}
      <rect x="266" y="216" width="228" height="58" rx="5" className="ssa-blk merge" />
      <text x="280" y="234" className="ssa-bt">merge</text>
      <text x="280" y="252" className="ssa-code">x₄ = φ(<tspan className={thenOn ? 'ssa-sel' : 'ssa-dim'}>x₂</tspan>, <tspan className={elseOn ? 'ssa-sel' : 'ssa-dim'}>x₃</tspan>) = {x4}</text>
      <text x="280" y="268" className="ssa-code">return x₄ = {x4}</text>

      <text x="600" y="250" className="ssa-note" textAnchor="middle">φ picks the</text>
      <text x="600" y="265" className="ssa-note" textAnchor="middle">taken edge → {took === 'then' ? 'x₂' : 'x₃'}</text>

      <text x="380" y="292" className="ssa-foot" textAnchor="middle">
        {on('why') ? 'every variable assigned once → each use names exactly one definition'
          : on('rename') ? 'reassignments become versions x₁, x₂, x₃ — def-use is explicit'
          : on('phi') ? 'two versions reach the join → φ(x₂, x₃) selects the one that ran'
          : on('frontier') ? 'φ goes only at dominance frontiers — minimal, near-linear to place'
          : on('opt') ? 'one def per use → const-prop, DCE, register allocation read off the graph'
          : `n = ${n} → ${took} branch → φ selects ${took === 'then' ? 'x₂' : 'x₃'} = ${x4} (same as the mutable original)`}
      </text>
    </svg>
  );
}
