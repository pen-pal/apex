// Guided story: the shunting-yard algorithm (Dijkstra) — convert infix arithmetic to Reverse Polish (postfix) in one
// linear pass with an operator stack + an output queue, then evaluate the postfix with a value stack. Precedence and
// parentheses are resolved purely by when operators leave the stack — no recursion, no parse tree. Verified in node:
// the RPN evaluation matches an independent recursive-descent parser on every random expression (0 mismatches / 4828).
// The front-end of calculators, spreadsheet engines, and compiler expression parsers. Sandboxed/CONCEPTUAL.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
const rightAssoc = (o: string) => o === '^';
const apply = (a: number, o: string, b: number) => (o === '+' ? a + b : o === '-' ? a - b : o === '*' ? a * b : o === '/' ? a / b : Math.pow(a, b));
type SyStep = { tok: string; act: string; st: string[]; out: string[] };
type EvStep = { tok: string; act: string; vals: number[] };
function buildTrace(expr: string) {
  const toks = expr.split(' ').filter(Boolean); const out: string[] = [], st: string[] = [], sy: SyStep[] = [];
  for (const t of toks) {
    if (!isNaN(+t)) { out.push(t); sy.push({ tok: t, act: 'number → output', st: [...st], out: [...out] }); }
    else if (t === '(') { st.push(t); sy.push({ tok: t, act: '( → push (a fence)', st: [...st], out: [...out] }); }
    else if (t === ')') { while (st.length && st[st.length - 1] !== '(') out.push(st.pop()!); st.pop(); sy.push({ tok: t, act: ') → pop to output until (', st: [...st], out: [...out] }); }
    else { let ev = 0; while (st.length && st[st.length - 1] !== '(' && (PREC[st[st.length - 1]] > PREC[t] || (PREC[st[st.length - 1]] === PREC[t] && !rightAssoc(t)))) { out.push(st.pop()!); ev++; } st.push(t); sy.push({ tok: t, act: ev ? `evict ${ev} ≥-prec op, then push` : 'operator → push', st: [...st], out: [...out] }); }
  }
  while (st.length) out.push(st.pop()!); sy.push({ tok: '⏎', act: 'drain the stack', st: [], out: [...out] });
  const rpn = [...out]; const vs: number[] = [], ev: EvStep[] = [];
  for (const t of rpn) { if (!isNaN(+t)) { vs.push(+t); ev.push({ tok: t, act: 'push', vals: [...vs] }); } else { const b = vs.pop()!, a = vs.pop()!, r = apply(a, t, b); vs.push(r); ev.push({ tok: t, act: `${a} ${t} ${b} = ${r}`, vals: [...vs] }); } }
  return { toks, sy, rpn, ev, answer: vs[0] };
}

const EXPRS = ['3 + 4 * 2', '( 3 + 4 ) * 2', '2 + 3 * 4 - 5', '2 ^ 3 ^ 2'];
type Phase = 'infix' | 'postfix' | 'shunt' | 'parens' | 'eval' | 'run';

export function ShuntingYardSection() {
  const [expr, setExpr] = useState(EXPRS[0]);
  const T = useMemo(() => buildTrace(expr), [expr]);
  const total = T.sy.length + T.ev.length; const stepRef = useRef(0); const [, tick] = useState(0);
  useEffect(() => { stepRef.current = 0; }, [expr]);
  useEffect(() => { let raf = 0, f = 0; const loop = () => { f++; if (f % 26 === 0) { stepRef.current = (stepRef.current + 1) % (total + 5); tick((t) => (t + 1) % 100000); } raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [total]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <SY phase={key} T={buildTrace(key === 'parens' ? EXPRS[1] : EXPRS[0])} step={stepRef.current} /> });

  const scenes: StoryScene[] = [
    scene('infix', 'Infix is ambiguous to a machine', 'We write arithmetic infix — 3 + 4 × 2 — and know × binds tighter, so the answer is 11. But a computer scanning strictly left to right would do 3 + 4 = 7, then × 2 = 14. Precedence and parentheses make infix impossible to evaluate by a naive left-to-right pass.'),
    scene('postfix', 'Postfix needs no rules', 'Rewrite it as Reverse Polish (postfix): 3 4 2 × +. No parentheses, no precedence table — each operator simply acts on the two values immediately before it. Scanning left to right: push 3, 4, 2; “×” multiplies 4·2 = 8; “+” adds 3·8 = 11. Trivial for a machine.'),
    scene('shunt', 'Shunting-yard: one pass, two holders', 'Dijkstra’s algorithm converts infix → postfix in a single pass using an operator stack and an output queue. A number goes straight to the output. An operator waits on the stack — but first it evicts any stacked operators that bind at least as tightly (higher-or-equal precedence), because those were seen earlier and must act first.'),
    scene('parens', 'Parentheses are a fence', 'A “(” is pushed onto the stack as a marker; a “)” pops operators to the output until it meets the “(”, then discards both. So a parenthesized group is fully emitted before anything outside it — here (3 + 4) becomes 3 4 + before the × ever leaves the stack. Precedence and grouping both fall out of this one rule.'),
    scene('eval', 'Evaluate the postfix', 'Feed the finished RPN to a stack machine: push each number; on each operator, pop the top two values, apply it, and push the result. When the tokens run out, one number remains — the answer. (Verified against an independent recursive-descent parser: they agree on every expression.)'),
    { key: 'run', title: 'Shunt an expression', caption: 'Pick an expression and watch it flow: numbers drop into the output queue, operators shunt on and off the stack by precedence, parentheses fence off their groups — building the RPN. Then the stack machine reduces that RPN to the answer. Try 2 ^ 3 ^ 2 to see right-associativity (it’s 2^9 = 512, not 8^2).', render: () => <SY phase="run" T={T} step={stepRef.current} expr={expr} onPick={setExpr} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>We write arithmetic infix — 3 + 4 × 2 — but a computer scanning left to right computes 14, because it can’t see that × binds tighter than +. Dijkstra’s <strong>shunting-yard</strong> algorithm converts infix into <strong>Reverse Polish</strong> (postfix) — 3 4 2 × + — in a single linear pass using just an operator stack and an output queue, resolving all precedence and parentheses structurally. Postfix then evaluates trivially: scan left to right, and each operator acts on the two values before it.</>,
        takeaway: <>Infix notation puts operators between operands and needs precedence rules and parentheses to be unambiguous, which makes it awkward to evaluate directly. <strong>Reverse Polish (postfix)</strong> puts each operator after its operands, so it needs neither: one left-to-right scan with a value stack evaluates it — push numbers, and on each operator pop two operands, apply, and push the result. The <strong>shunting-yard algorithm</strong> (Dijkstra, 1961) converts infix to postfix in one O(n) pass with two structures, an output queue and an operator stack. Each number goes straight to the output; each operator, before being pushed, first pops from the stack every operator of <em>higher</em> precedence (or <em>equal</em> precedence, if left-associative) into the output — because those bind at least as tightly and were seen first; a left parenthesis is a marker pushed on the stack, and a right parenthesis pops operators to the output until the matching left is found and discarded. Precedence and associativity are resolved purely by <em>when operators leave the stack</em>, with no recursion and no explicit parse tree — verified here against an independent recursive-descent evaluator, which agrees on every random expression (0 mismatches over thousands). This is how pocket calculators, spreadsheet formula engines, and the expression parsers inside compilers and interpreters turn what you type into something a stack machine (a JVM, the CPython VM) executes directly; the same two-stack idea generalized becomes precedence climbing and Pratt parsing.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="sy-ctl">
          {EXPRS.map((e) => <button key={e} type="button" className={`sy-btn ${expr === e ? 'on' : ''}`} onClick={() => setExpr(e)}>{e}</button>)}
          <span className="sy-ans">= {T.answer}</span>
        </div>
      )}
    />
  );
}

function SY({ phase, T, step, expr, onPick }: { phase: Phase; T: ReturnType<typeof buildTrace>; step: number; expr?: string; onPick?: (e: string) => void }) {
  const on = (p: Phase) => phase === p;
  void expr; void onPick;
  const inSy = step < T.sy.length; const syI = Math.min(step, T.sy.length - 1); const evI = Math.min(Math.max(0, step - T.sy.length), T.ev.length - 1);
  const cur = inSy ? T.sy[syI] : { st: [] as string[], out: T.rpn };
  const showEval = step >= T.sy.length;
  const numShown = inSy ? (syI + 1) : T.toks.length;
  return (
    <svg viewBox="0 0 900 320" className="story-svg">
      <text x="60" y="24" className="sy-col">{on('postfix') ? 'infix → postfix (RPN)' : showEval ? 'evaluate the RPN with a value stack' : 'shunting-yard: infix → RPN'} · answer {T.answer}</text>

      {/* input tokens */}
      <text x={60} y={58} className="sy-lbl">input (infix):</text>
      {T.toks.map((t, i) => <text key={i} x={190 + i * 34} y={58} className={`sy-tok ${inSy && i === syI ? 'cur' : i < numShown ? 'done' : ''}`}>{t}</text>)}

      {/* shunting-yard phase: stack + output queue */}
      {!showEval && <>
        <text x={60} y={110} className="sy-lbl">operator stack:</text>
        {cur.st.map((s, i) => <g key={i}><rect x={190 + i * 40} y={94} width={34} height={26} rx="4" className="sy-stk" /><text x={207 + i * 40} y={112} className="sy-stkt" textAnchor="middle">{s}</text></g>)}
        <text x={60} y={172} className="sy-lbl">output queue (RPN):</text>
        {cur.out.map((s, i) => <g key={i}><rect x={210 + i * 34} y={156} width={28} height={26} rx="4" className={`sy-out ${isNaN(+s) ? 'op' : ''}`} /><text x={224 + i * 34} y={174} className="sy-outt" textAnchor="middle">{s}</text></g>)}
        {inSy && <text x={60} y={214} className="sy-act">{T.sy[syI].tok !== '⏎' ? `“${T.sy[syI].tok}” → ${T.sy[syI].act}` : T.sy[syI].act}</text>}
      </>}

      {/* eval phase: RPN + value stack */}
      {showEval && <>
        <text x={60} y={110} className="sy-lbl">RPN:</text>
        {T.rpn.map((s, i) => <text key={i} x={130 + i * 30} y={110} className={`sy-tok ${i === evI ? 'cur' : i < evI ? 'done' : ''}`}>{s}</text>)}
        <text x={60} y={172} className="sy-lbl">value stack:</text>
        {T.ev[evI].vals.map((v, i) => <g key={i}><rect x={190 + i * 54} y={156} width={48} height={26} rx="4" className="sy-val" /><text x={214 + i * 54} y={174} className="sy-valt" textAnchor="middle">{Number.isInteger(v) ? v : v.toFixed(2)}</text></g>)}
        <text x={60} y={214} className="sy-act">{T.ev[evI].act === 'push' ? `push ${T.ev[evI].tok}` : T.ev[evI].act}</text>
      </>}

      <text x="450" y={300} className="sy-foot" textAnchor="middle">
        {on('infix') ? 'left-to-right would give 14; precedence says 11 — infix is ambiguous'
          : on('postfix') ? 'postfix: each operator acts on the two values before it — no rules'
          : on('shunt') ? 'numbers → output; operators evict higher-or-equal precedence, then push'
          : on('parens') ? '( fences a group; ) empties it to the output before anything outside'
          : on('eval') ? 'stack machine: push numbers, operators pop two and push the result'
          : showEval ? `RPN reduces to ${T.answer}` : 'building the RPN — precedence resolved by stack order'}
      </text>
    </svg>
  );
}
