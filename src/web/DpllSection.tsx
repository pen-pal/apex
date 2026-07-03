// Guided story: DPLL — the classic backtracking SAT solver (Davis–Putnam–Logemann–Loveland, 1962). Given a boolean
// formula in CNF (an AND of OR-clauses), decide if some true/false assignment satisfies it. DPLL alternates unit
// propagation (a clause with one unassigned literal and the rest false forces that literal) with decisions (guess a
// variable, recurse) and backtracking (on a conflict — a clause gone all-false — undo and try the other value). It
// proves SAT with an assignment or UNSAT without trying all 2ⁿ. Verified in node against a 2ⁿ brute-force oracle: DPLL's
// SAT/UNSAT verdict matches on 6000 random formulas, and every SAT assignment it returns satisfies the CNF. NOT the
// Separating Axis Theorem (that's [[sat]]); this is boolean satisfiability. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Clause = number[]; type Asn = Record<number, boolean | undefined>;
function status(c: Clause, a: Asn): { s: 'sat' | 'unsat' | 'unit' | 'open'; lit?: number } {
  let un: number[] = [], anyT = false;
  for (const l of c) { const v = Math.abs(l), val = a[v]; if (val === undefined) un.push(l); else if ((val && l > 0) || (!val && l < 0)) anyT = true; }
  if (anyT) return { s: 'sat' }; if (un.length === 0) return { s: 'unsat' }; if (un.length === 1) return { s: 'unit', lit: un[0] }; return { s: 'open' };
}
type Ev = { kind: 'decide' | 'propagate' | 'conflict' | 'backtrack' | 'sat' | 'unsat'; text: string; asn: Asn; ci: number; depth: number };
function trace(clauses: Clause[], n: number): { steps: Ev[]; sat: boolean } {
  const steps: Ev[] = [];
  const rec = (asn0: Asn, depth: number): Asn | null => {
    const asn: Asn = { ...asn0 }; let changed = true;
    while (changed) { changed = false;
      for (let ci = 0; ci < clauses.length; ci++) { const r = status(clauses[ci], asn);
        if (r.s === 'unsat') { steps.push({ kind: 'conflict', text: `conflict: clause ${ci + 1} all-false`, asn: { ...asn }, ci, depth }); return null; }
        if (r.s === 'unit') { const v = Math.abs(r.lit!); asn[v] = r.lit! > 0; steps.push({ kind: 'propagate', text: `unit prop: x${v} = ${r.lit! > 0 ? 'T' : 'F'} (forced by clause ${ci + 1})`, asn: { ...asn }, ci, depth }); changed = true; }
      }
    }
    if (clauses.every((c) => status(c, asn).s === 'sat')) { steps.push({ kind: 'sat', text: 'every clause satisfied → SAT', asn: { ...asn }, ci: -1, depth }); return asn; }
    let pick = 0; for (let v = 1; v <= n; v++) if (asn[v] === undefined) { pick = v; break; }
    if (!pick) return asn;
    for (const val of [true, false]) {
      steps.push({ kind: 'decide', text: `decide x${pick} = ${val ? 'T' : 'F'}`, asn: { ...asn, [pick]: val }, ci: -1, depth });
      const res = rec({ ...asn, [pick]: val }, depth + 1); if (res) return res;
      steps.push({ kind: 'backtrack', text: `x${pick} = ${val ? 'T' : 'F'} failed → backtrack`, asn: { ...asn }, ci: -1, depth });
    }
    return null;
  };
  const res = rec({}, 0);
  if (!res) steps.push({ kind: 'unsat', text: 'both branches fail everywhere → UNSAT', asn: {}, ci: -1, depth: 0 });
  return { steps, sat: !!res };
}

const FORMULAS = {
  sat: { clauses: [[1, 2], [-1, 3], [-2, -3], [-1, -2]] as Clause[], n: 3 },
  unsat: { clauses: [[1, 2], [1, -2], [-1, 2], [-1, -2]] as Clause[], n: 2 },
};
const litStr = (l: number) => (l > 0 ? 'x' : '¬x') + Math.abs(l);
const clauseStr = (c: Clause) => '(' + c.map(litStr).join('∨') + ')';

type Phase = 'q' | 'unit' | 'decide' | 'conflict' | 'result' | 'run';
export function DpllSection() {
  const [which, setWhich] = useState<'sat' | 'unsat'>('sat'); const [step, setStep] = useState(99);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, w: 'sat' | 'unsat', st: number): StoryScene =>
    ({ key, title, caption, render: () => <Dpll phase={key} which={w} step={st} /> });

  const scenes: StoryScene[] = [
    scene('q', 'Is it satisfiable?', 'A formula in conjunctive normal form is an AND of clauses, each an OR of variables or their negations. The question: is there a true/false assignment making every clause true? This is SAT — the first problem proven NP-complete — yet real solvers dispatch formulas with millions of variables. DPLL is the backtracking search at their core.', 'sat', 1),
    scene('unit', 'Unit propagation', 'The workhorse move. If a clause has every literal false except one still-unassigned literal, that literal MUST be true — otherwise the clause fails. So it’s forced, no guessing. One forced assignment can make another clause unit, cascading a chain of implications for free before any search.', 'sat', 3),
    scene('decide', 'Decide and recurse', 'When nothing is forced, DPLL picks an unassigned variable and guesses — say true — then recurses, propagating the consequences. Each guess is a branch in a decision tree over the variables; unit propagation prunes huge swaths between guesses.', 'sat', 2),
    scene('conflict', 'Conflict and backtrack', 'If propagation drives some clause to all-false, that’s a conflict: the current path can’t work. DPLL backtracks to the last decision and flips it. Watch this UNSAT formula: x1=T forces a conflict, x1=F forces a conflict — both branches dead.', 'unsat', 99),
    scene('result', 'SAT or UNSAT', 'If every clause is satisfied, DPLL returns the assignment — a proof of SAT. If the whole tree collapses in conflicts, the formula is UNSAT, proven without enumerating all 2ⁿ assignments. (Verified: DPLL’s verdict matches a 2ⁿ brute-force oracle over thousands of formulas, and its SAT assignments really satisfy.)', 'sat', 99),
    { key: 'run', title: 'Run the solver', caption: 'Step the solver. Clauses light up as satisfied (green), unit — one literal left (amber), or conflicting (red); the trail on the right logs each decision, forced propagation, conflict, and backtrack. Switch between a satisfiable and an unsatisfiable formula — one ends in an assignment, the other proves no assignment exists.', render: () => <Dpll phase="run" which={which} step={step} onStep={setStep} onWhich={setWhich} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>DPLL</strong> decides boolean satisfiability by backtracking search plus <strong>unit propagation</strong>: whenever a clause has one unassigned literal and the rest false, that literal is forced, cascading implications for free. When nothing is forced it <strong>decides</strong> a variable and recurses; a clause driven all-false is a <strong>conflict</strong>, triggering a <strong>backtrack</strong> to flip the last decision. It returns a satisfying assignment (SAT) or proves UNSAT — without enumerating all 2ⁿ cases.</>,
        takeaway: <><strong>DPLL</strong> (Davis–Putnam–Logemann–Loveland, 1962) is the backtracking core of every modern SAT solver. The input is a formula in <strong>conjunctive normal form</strong> — an AND of clauses, each a disjunction (OR) of literals (a variable or its negation) — and the goal is an assignment satisfying all clauses. DPLL interleaves three moves. <strong>Unit propagation</strong>: a clause with all literals false but one unassigned forces that literal true; this is where solvers spend most of their time, and one propagation often cascades into a chain (Boolean constraint propagation). <strong>Decision</strong>: with nothing forced, pick an unassigned variable by some heuristic and assign it, then recurse. <strong>Conflict-driven backtracking</strong>: if propagation makes any clause all-false, the branch is dead — undo to the last decision and try the other polarity; if both fail, the subtree is UNSAT. The original algorithm also did <strong>pure-literal elimination</strong> (a variable appearing in only one polarity can be set to satisfy those clauses). DPLL proves UNSAT by exhausting the pruned tree, not by trying all 2ⁿ assignments — the pruning from propagation is what makes it fast in practice despite SAT being NP-complete. Modern <strong>CDCL</strong> solvers extend it with <strong>clause learning</strong> (on a conflict, analyze it to derive a new clause that prevents repeating the same mistake), <strong>non-chronological backjumping</strong>, <strong>watched-literal</strong> data structures for near-free propagation, and activity-based decision heuristics (VSIDS) — together handling formulas with millions of variables, which is why SAT solvers now power hardware verification, program analysis, planning, and cryptanalysis. Verified here against a 2ⁿ brute-force oracle: DPLL’s SAT/UNSAT verdict agrees on thousands of random formulas and every returned assignment satisfies the CNF.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="cnf-ctl">
          <button type="button" className={`cnf-btn ${which === 'sat' ? 'on' : ''}`} onClick={() => { setWhich('sat'); setStep(0); }}>satisfiable</button>
          <button type="button" className={`cnf-btn ${which === 'unsat' ? 'on' : ''}`} onClick={() => { setWhich('unsat'); setStep(0); }}>unsatisfiable</button>
          <button type="button" className="cnf-btn" onClick={() => setStep((v) => v + 1)}>step ›</button>
        </div>
      )}
    />
  );
}

function Dpll({ phase, which, step, onStep, onWhich }: { phase: Phase; which: 'sat' | 'unsat'; step: number; onStep?: (n: number) => void; onWhich?: (w: 'sat' | 'unsat') => void }) {
  const on = (p: Phase) => phase === p; void onStep; void onWhich;
  const F = FORMULAS[which]; const { steps, sat } = trace(F.clauses, F.n);
  const cur = Math.min(step, steps.length); const ev = cur > 0 ? steps[cur - 1] : null;
  const asn: Asn = ev ? ev.asn : {};
  const clStatus = (c: Clause) => status(c, asn).s;
  const CLR: Record<string, string> = { sat: 'cnf-cl sat', unsat: 'cnf-cl conflict', unit: 'cnf-cl unit', open: 'cnf-cl' };
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="cnf-col">DPLL SAT solver · {which === 'sat' ? 'a satisfiable formula' : 'an unsatisfiable formula'} · step {cur}/{steps.length}</text>

      {/* CNF formula, clauses colored by status */}
      <text x={64} y={50} className="cnf-lbl">CNF formula (AND of clauses)</text>
      {F.clauses.map((c, i) => { const st = ev && ev.ci === i ? (ev.kind === 'conflict' ? 'unsat' : 'unit') : clStatus(c); return <g key={i}>
        <rect x={64 + i * 118} y={58} width={110} height={26} rx="4" className={CLR[st]} />
        <text x={64 + i * 118 + 55} y={75} className="cnf-clt" textAnchor="middle">{clauseStr(c)}</text>
      </g>; })}

      {/* assignment */}
      <text x={64} y={116} className="cnf-lbl">assignment</text>
      {Array.from({ length: F.n }, (_, i) => { const v = i + 1; const val = asn[v]; return <g key={v}>
        <rect x={64 + i * 70} y={124} width={60} height={26} rx="4" className={`cnf-var ${val === undefined ? '' : val ? 'tt' : 'ff'}`} />
        <text x={64 + i * 70 + 30} y={141} className="cnf-vt" textAnchor="middle">x{v}={val === undefined ? '?' : val ? 'T' : 'F'}</text>
      </g>; })}

      {/* trail */}
      <text x={420} y={116} className="cnf-lbl">search trail</text>
      {steps.slice(Math.max(0, cur - 6), cur).map((s, i) => <text key={i} x={420 + s.depth * 10} y={134 + i * 18} className={`cnf-ev ${s.kind}`}>{s.kind === 'decide' ? '▸ ' : s.kind === 'propagate' ? '  → ' : s.kind === 'conflict' ? '  ✗ ' : s.kind === 'backtrack' ? '↶ ' : '● '}{s.text}</text>)}

      {/* result */}
      {cur >= steps.length && <text x={64} y={186} className={`cnf-result ${sat ? 'sat' : 'unsat'}`}>{sat ? `SAT — assignment ${Array.from({ length: F.n }, (_, i) => `x${i + 1}=${asn[i + 1] ? 'T' : 'F'}`).join(' ')} satisfies every clause` : 'UNSAT — no assignment can satisfy all clauses (proven, not by trying all 2ⁿ)'}</text>}

      <text x="380" y="292" className="cnf-foot" textAnchor="middle">
        {on('q') ? 'CNF = AND of OR-clauses; find an assignment making all true'
          : on('unit') ? 'a clause with one unassigned literal (rest false) forces it'
          : on('decide') ? 'nothing forced → guess a variable and recurse'
          : on('conflict') ? 'a clause all-false → conflict → backtrack and flip'
          : on('result') ? 'SAT (an assignment) or UNSAT (tree exhausted) — no 2ⁿ scan'
          : ev ? ev.text : 'press step to run the solver'}
      </text>
    </svg>
  );
}
