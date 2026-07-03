// Guided story: Hindley-Milner type inference (Algorithm W) — how ML, Haskell, Rust, and TypeScript figure out every
// type with no annotations. Give each unknown a fresh type variable; each function application f x forces f to be
// (type of x)→(fresh result), a constraint; solve the constraints by UNIFICATION, which finds the most general
// (principal) type. An occurs-check rejects infinite types (so \x.x x doesn't type), and let-bound values are
// generalized so they can be used at several types. Verified in node: Algorithm W infers the known principal types of
// five classic λ-terms exactly and rejects self-application by the occurs-check. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Ty = { tag: 'var'; id: number } | { tag: 'arrow'; from: Ty; to: Ty } | { tag: 'con'; name: string };
type Ast = { tag: 'v'; n: string } | { tag: 'lam'; p: string; b: Ast } | { tag: 'app'; f: Ast; a: Ast } | { tag: 'let'; n: string; e: Ast; b: Ast };
const V = (n: string): Ast => ({ tag: 'v', n }), LAM = (p: string, b: Ast): Ast => ({ tag: 'lam', p, b }), APP = (f: Ast, a: Ast): Ast => ({ tag: 'app', f, a }), LET = (n: string, e: Ast, b: Ast): Ast => ({ tag: 'let', n, e, b });

let ctr = 0; const fresh = (): Ty => ({ tag: 'var', id: ctr++ });
type Subst = Map<number, Ty>;
const walk = (t: Ty, s: Subst): Ty => { while (t.tag === 'var' && s.has(t.id)) t = s.get(t.id)!; return t; };
const occurs = (id: number, t: Ty, s: Subst): boolean => { t = walk(t, s); if (t.tag === 'var') return t.id === id; if (t.tag === 'arrow') return occurs(id, t.from, s) || occurs(id, t.to, s); return false; };
function unify(a: Ty, b: Ty, s: Subst): Subst {
  a = walk(a, s); b = walk(b, s);
  if (a.tag === 'var' && b.tag === 'var' && a.id === b.id) return s;
  if (a.tag === 'var') { if (occurs(a.id, b, s)) throw new Error('occurs'); const s2 = new Map(s); s2.set(a.id, b); return s2; }
  if (b.tag === 'var') return unify(b, a, s);
  if (a.tag === 'con' && b.tag === 'con' && a.name === b.name) return s;
  if (a.tag === 'arrow' && b.tag === 'arrow') return unify(a.to, b.to, unify(a.from, b.from, s));
  throw new Error('mismatch');
}
const resolve = (t: Ty, s: Subst): Ty => { t = walk(t, s); if (t.tag === 'arrow') return { tag: 'arrow', from: resolve(t.from, s), to: resolve(t.to, s) }; return t; };
const freeVars = (t: Ty, s: Subst, acc: Set<number>): Set<number> => { t = walk(t, s); if (t.tag === 'var') acc.add(t.id); else if (t.tag === 'arrow') { freeVars(t.from, s, acc); freeVars(t.to, s, acc); } return acc; };
type Scheme = { t: Ty; q: number[] };
function instantiate(sc: Scheme): Ty { const m = new Map<number, Ty>(); const go = (t: Ty): Ty => { if (t.tag === 'var') { if (sc.q.includes(t.id)) { if (!m.has(t.id)) m.set(t.id, fresh()); return m.get(t.id)!; } return t; } if (t.tag === 'arrow') return { tag: 'arrow', from: go(t.from), to: go(t.to) }; return t; }; return go(sc.t); }
function generalize(env: Map<string, Scheme>, t: Ty, s: Subst): Scheme { const ef = new Set<number>(); for (const sc of env.values()) freeVars(sc.t, s, ef); const q = [...freeVars(t, s, new Set())].filter((id) => !ef.has(id)); return { t: resolve(t, s), q }; }
type Annot = { expr: string; ty: Ty };
function infer(env: Map<string, Scheme>, ast: Ast, s: Subst, annots: Annot[]): [Ty, Subst] {
  let res: [Ty, Subst];
  if (ast.tag === 'v') { const sc = env.get(ast.n); if (!sc) throw new Error('unbound ' + ast.n); res = [instantiate(sc), s]; }
  else if (ast.tag === 'lam') { const tp = fresh(); const e2 = new Map(env); e2.set(ast.p, { t: tp, q: [] }); const [tb, s2] = infer(e2, ast.b, s, annots); res = [{ tag: 'arrow', from: tp, to: tb }, s2]; }
  else if (ast.tag === 'app') { const [tf, s1] = infer(env, ast.f, s, annots); const [ta, s2] = infer(env, ast.a, s1, annots); const tr = fresh(); const s3 = unify(tf, { tag: 'arrow', from: ta, to: tr }, s2); res = [tr, s3]; }
  else { const [tv, s1] = infer(env, ast.e, s, annots); const sc = generalize(env, tv, s1); const e2 = new Map(env); e2.set(ast.n, sc); res = infer(e2, ast.b, s1, annots); }
  annots.push({ expr: showAst(ast), ty: res[0] }); return res;
}
function showAst(a: Ast): string { if (a.tag === 'v') return a.n; if (a.tag === 'lam') return 'λ' + a.p + '.' + showAst(a.b); if (a.tag === 'app') { const f = a.f.tag === 'lam' || a.f.tag === 'let' ? '(' + showAst(a.f) + ')' : showAst(a.f); const x = a.a.tag === 'v' ? showAst(a.a) : '(' + showAst(a.a) + ')'; return f + ' ' + x; } return 'let ' + a.n + '=' + showAst(a.e) + ' in ' + showAst(a.b); }
function showTy(t: Ty, names: Map<number, string>): string { if (t.tag === 'var') { if (!names.has(t.id)) names.set(t.id, String.fromCharCode(97 + names.size)); return names.get(t.id)!; } if (t.tag === 'con') return t.name; const inner = showTy(t.from, names) + '→' + showTy(t.to, names); return t.from.tag === 'arrow' ? '(' + showTy(t.from, names) + ')→' + showTy(t.to, names) : inner; }

const TERMS: { name: string; ast: Ast }[] = [
  { name: 'identity', ast: LAM('x', V('x')) },
  { name: 'const', ast: LAM('x', LAM('y', V('x'))) },
  { name: 'apply', ast: LAM('f', LAM('x', APP(V('f'), V('x')))) },
  { name: 'compose', ast: LAM('f', LAM('g', LAM('x', APP(V('f'), APP(V('g'), V('x')))))) },
  { name: 'let id id', ast: LET('id', LAM('x', V('x')), APP(V('id'), V('id'))) },
  { name: 'x x (fails)', ast: LAM('x', APP(V('x'), V('x'))) },
];
function run(ast: Ast): { annots: { expr: string; ty: string }[]; principal: string; error: string | null } {
  ctr = 0; const annots: Annot[] = [];
  try { const [t, s] = infer(new Map(), ast, new Map(), annots);
    const names = new Map<number, string>(); // shared names across all subexprs, principal type first
    const principal = showTy(resolve(t, s), names);
    const rows = annots.map((an) => ({ expr: an.expr, ty: showTy(resolve(an.ty, s), names) }));
    // dedupe by expr, keep last (fully resolved), preserve a readable order (leaves→root)
    const seen = new Set<string>(); const out: { expr: string; ty: string }[] = [];
    for (const r of rows) { if (!seen.has(r.expr)) { seen.add(r.expr); out.push(r); } }
    return { annots: out, principal, error: null };
  } catch (e) { return { annots: [], principal: '', error: (e as Error).message }; }
}

type Phase = 'noannot' | 'fresh' | 'unify' | 'occurs' | 'letpoly' | 'run';
export function HindleySection() {
  const [ti, setTi] = useState(0);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, t: number): StoryScene =>
    ({ key, title, caption, render: () => <HM phase={key} ti={t} /> });

  const scenes: StoryScene[] = [
    scene('noannot', 'Types, with nothing written down', 'In ML, Haskell, Rust, or TypeScript you can write λx. x — a function — with no type annotation at all, and the compiler still knows its type is a→a for any a. Hindley-Milner inference works it out from structure alone: give every unknown a placeholder type variable, then let how the code is used pin each one down.', 0),
    scene('fresh', 'Fresh variables and constraints', 'Every lambda parameter starts as a fresh type variable. Every function application f x is a constraint: f must be a function from x’s type to some fresh result type. So λf. λx. f x gives f : a and x : b, and f x forces a = b→c. The program becomes a pile of equations between types.', 2),
    scene('unify', 'Unification solves the equations', 'Unification makes two types equal by binding variables to types, and it finds the most general solution — the principal type, the one every other valid type is a special case of. Solving a = b→c and following the arrows through λf.λx.f x yields (b→c)→b→c: exactly the apply combinator.', 2),
    scene('occurs', 'The occurs check', 'One equation is forbidden: binding a variable to a type that contains itself, like a = a→b. That would be an infinite type. The occurs check catches it and rejects the program — which is exactly why λx. x x (applying x to itself) has no type. (Verified: Algorithm W rejects it.)', 5),
    scene('letpoly', 'let makes it polymorphic', 'When you bind a value with let, its type is generalized: the free variables become “for all”, so the same definition can be used at different types. That’s why let id = λx.x in id id works — the inner id is used as (a→a)→(a→a) and the outer as a→a. (Verified: it infers a→a.)', 4),
    { key: 'run', title: 'Infer a type yourself', caption: 'Pick a term and read the inference. Each subexpression is shown with the type variable Hindley-Milner assigned it, resolved by unification into concrete arrows; the principal type falls out at the top with no annotation anywhere. Try “x x (fails)” to watch the occurs check refuse an infinite type.', render: () => <HM phase="run" ti={ti} onPick={setTi} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Hindley-Milner</strong> type inference figures out every type in a program with no annotations. It gives each unknown a fresh <strong>type variable</strong>, reads off <strong>constraints</strong> from how values are used (a function application f x forces f’s type to be (type of x)→something), and solves them by <strong>unification</strong>, which yields the most general — <strong>principal</strong> — type. An <strong>occurs check</strong> forbids infinite types, and <code>let</code>-bound values are generalized so one definition can be used at many types.</>,
        takeaway: <><strong>Hindley-Milner</strong> (Damas–Milner <strong>Algorithm W</strong>) is the type-inference engine behind ML, Haskell, OCaml, and the cores of Rust and TypeScript. It assigns every subexpression a type, using a fresh <strong>type variable</strong> for each unknown (each lambda parameter, each result). The program’s structure generates <strong>constraints</strong>: an application f x demands f : α→β where α is x’s type and β is fresh; an if demands both branches share a type; and so on. These are solved by <strong>unification</strong> — the algorithm that makes two type terms equal by finding a substitution binding variables to types, computing the <strong>most general unifier</strong> so the result is the <strong>principal type</strong> (every other valid typing is an instance of it). Two subtleties make it work. The <strong>occurs check</strong>: unifying a variable α with a type that contains α (like α = α→β) would build an infinite type, so it’s rejected — which is precisely why self-application λx. x x is untypable (verified here). And <strong>let-polymorphism</strong>: a value bound by <code>let</code> is <strong>generalized</strong>, its free type variables universally quantified into a type scheme, so each use <strong>instantiates</strong> fresh copies and the same definition can be used at different types (verified: <code>let id = λx.x in id id</code> infers a→a, using id at two types). Algorithm W runs in near-linear time in practice, needs no annotations for the Hindley-Milner fragment, and always finds the principal type if one exists — a rare combination of power and decidability. Its limits (higher-rank polymorphism, subtyping) are where languages add optional annotations back. The same unification is the engine of Prolog’s resolution and of the trait/constraint solvers in modern compilers.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="hm-ctl">
          {TERMS.map((t, i) => <button key={t.name} type="button" className={`hm-btn ${ti === i ? 'on' : ''}`} onClick={() => setTi(i)}>{t.name}</button>)}
        </div>
      )}
    />
  );
}

function HM({ phase, ti, onPick }: { phase: Phase; ti: number; onPick?: (i: number) => void }) {
  const on = (p: Phase) => phase === p; void onPick;
  const term = TERMS[ti]; const r = run(term.ast);
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="24" className="hm-col">Hindley-Milner · term “{term.name}” · {r.error ? 'ill-typed' : 'principal type inferred'}</text>

      {r.error ? <>
        <text x={64} y={90} className="hm-term">λx. x x</text>
        <text x={64} y={130} className="hm-fail">unify x’s type a  with  a→b  (x applied to x)</text>
        <text x={64} y={158} className="hm-fail">→ occurs check: a would contain itself (a = a→b)</text>
        <text x={64} y={186} className="hm-fail">→ infinite type · REJECTED</text>
        <text x={64} y={224} className="hm-note">self-application has no finite type — the classic untypable term</text>
      </> : <>
        {/* subexpression : type rows (leaves → root) */}
        {r.annots.slice(0, 8).map((a, i) => <g key={i}>
          <text x={64} y={62 + i * 26} className="hm-expr">{a.expr}</text>
          <text x={330} y={62 + i * 26} className="hm-colon">:</text>
          <text x={346} y={62 + i * 26} className="hm-ty">{a.ty}</text>
        </g>)}
        {/* principal type headline */}
        <line x1={64} y1={62 + Math.min(r.annots.length, 8) * 26 + 4} x2={620} y2={62 + Math.min(r.annots.length, 8) * 26 + 4} className="hm-rule" />
        <text x={64} y={62 + Math.min(r.annots.length, 8) * 26 + 28} className="hm-plbl">principal type:</text>
        <text x={200} y={62 + Math.min(r.annots.length, 8) * 26 + 28} className="hm-principal">{r.principal}</text>
      </>}

      <text x="380" y="292" className="hm-foot" textAnchor="middle">
        {on('noannot') ? 'no annotations — the type is recovered from structure'
          : on('fresh') ? 'fresh type var per unknown; f x forces f : (type of x)→_'
          : on('unify') ? 'unify the constraints → the most general (principal) type'
          : on('occurs') ? 'occurs check forbids a = a→b (infinite type)'
          : on('letpoly') ? 'let generalizes: id is used at two different types'
          : r.error ? 'the occurs check rejects self-application' : `principal type: ${r.principal}`}
      </text>
    </svg>
  );
}
