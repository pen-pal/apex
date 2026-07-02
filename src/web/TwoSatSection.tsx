// 2-SAT, made visible. Each clause becomes two implication arrows in a graph over the literals x_i and ¬x_i;
// strongly-connected components are coloured. If a variable and its negation share a colour (same SCC), the
// formula is a contradiction (UNSAT); otherwise the SCC order reads off a satisfying assignment. Pick a formula.
// Real logic from twosat.ts.
import { useMemo, useState } from 'react';
import { solve2sat, type Clause } from './twosat';

const C = (a: number, aTrue: boolean, b: number, bTrue: boolean): Clause => ({ a, aTrue, b, bTrue });
const PRESETS: Record<string, { n: number; clauses: Clause[] }> = {
  satisfiable: { n: 3, clauses: [C(0, true, 1, true), C(0, false, 2, true), C(1, false, 2, false)] },
  'forces a value': { n: 2, clauses: [C(0, true, 1, true), C(0, false, 1, true)] },
  unsatisfiable: { n: 2, clauses: [C(0, true, 1, true), C(0, true, 1, false), C(0, false, 1, true), C(0, false, 1, false)] },
};
const HUES = [212, 150, 28, 280, 340, 90, 190, 50, 0, 120];
const litName = (v: number, val: boolean) => `${val ? '' : '¬'}x${v}`;

export function TwoSatSection() {
  const [key, setKey] = useState('satisfiable');
  const { n, clauses } = PRESETS[key];
  const sol = useMemo(() => solve2sat(n, clauses), [n, clauses]);

  const W = 520, H = 200, colW = W / (n + 1);
  const px = (v: number) => colW * (v + 1);
  const pyTop = 46, pyBot = H - 46;
  const nodePos = (l: number): [number, number] => [px(Math.floor(l / 2)), l % 2 === 0 ? pyTop : pyBot];
  const edges = useMemo(() => {
    const e: [number, number][] = [];
    for (const c of clauses) { const la = 2 * c.a + (c.aTrue ? 0 : 1), lb = 2 * c.b + (c.bTrue ? 0 : 1); e.push([la ^ 1, lb], [lb ^ 1, la]); }
    return e;
  }, [clauses]);

  return (
    <div className="tsat">
      <p className="tsat-intro">
        A 2-literal clause <strong>(a ∨ b)</strong> is the same as two implications: <strong>¬a ⇒ b</strong> and
        <strong> ¬b ⇒ a</strong>. Build the implication graph over all literals and find its
        <strong> strongly-connected components</strong>. If some variable and its negation end up in the
        <em> same</em> component, the formula contradicts itself — <strong>UNSAT</strong>. Otherwise the component
        order hands you a satisfying assignment. One SCC pass, linear time.
      </p>

      <div className="tsat-tabs">{Object.keys(PRESETS).map((k) => <button key={k} type="button" className={`tsat-tab ${k === key ? 'on' : ''}`} onClick={() => setKey(k)}>{k}</button>)}</div>

      <div className="tsat-formula">
        {clauses.map((c, i) => <span key={i} className="tsat-clause">(<b>{litName(c.a, c.aTrue)}</b> ∨ <b>{litName(c.b, c.bTrue)}</b>)</span>)}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="tsat-graph">
        <defs><marker id="tsatarrow" markerWidth="7" markerHeight="7" refX="6" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4 Z" className="tsat-ah" /></marker></defs>
        {edges.map(([u, v], i) => {
          const [x1, y1] = nodePos(u), [x2, y2] = nodePos(v);
          const mx = (x1 + x2) / 2 + (y1 === y2 ? 0 : 14), my = (y1 + y2) / 2;
          return <path key={i} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} className="tsat-edge" markerEnd="url(#tsatarrow)" />;
        })}
        {Array.from({ length: 2 * n }, (_, l) => {
          const [x, y] = nodePos(l); const hue = HUES[sol.comp[l] % HUES.length];
          const conflict = !sol.sat && Math.floor(l / 2) === sol.conflictVar;
          return (
            <g key={l}>
              <circle cx={x} cy={y} r={15} fill={`hsl(${hue} 55% 45% / .9)`} stroke={conflict ? '#ff5555' : 'var(--panel)'} strokeWidth={conflict ? 2.5 : 1.5} />
              <text x={x} y={y + 4} textAnchor="middle" className="tsat-nt">{litName(Math.floor(l / 2), l % 2 === 0)}</text>
            </g>
          );
        })}
      </svg>
      <div className="tsat-legend">nodes coloured by SCC · an arrow u→v means "u implies v"</div>

      <div className={`tsat-verdict ${sol.sat ? 'ok' : 'bad'}`}>
        {sol.sat
          ? <>✓ <b>SATISFIABLE</b> — assignment: {sol.assignment.map((a, i) => <span key={i} className="tsat-asn">x{i}={a ? 'T' : 'F'}</span>)}</>
          : <>✗ <b>UNSATISFIABLE</b> — x{sol.conflictVar} and ¬x{sol.conflictVar} are in the same component, so x{sol.conflictVar} ⇒ ¬x{sol.conflictVar} ⇒ x{sol.conflictVar}: a contradiction.</>}
      </div>

      <p className="tsat-foot">
        One linear-time SCC computation answers both questions at once. Reachability in the
        implication graph is transitive — a path xᵢ → … → ¬xᵢ means "assuming xᵢ true forces xᵢ false" — and a
        strongly-connected component is precisely a set of literals that all imply each other, hence must share a
        truth value. So xᵢ and ¬xᵢ in one component is an immediate, unfixable contradiction. When there's no such
        clash, condensing the graph to its components gives a DAG, and processing it in reverse topological order
        (which Tarjan's algorithm produces for free) lets you set each variable to whatever its later component
        demands, never contradicting an earlier choice — that's why the witness is valid by construction. The
        contrast with general SAT is stark: at 2 literals per clause the problem is in P, but bump to 3 literals and
        3-SAT is NP-complete — one of the sharpest complexity cliffs in computer science, and the canonical
        NP-complete problem everything else reduces to. 2-SAT's tractability makes it a quiet workhorse: deciding
        which map labels to flip left/right without overlap, either/or scheduling and register-allocation
        constraints, and consistency checks in solvers all reduce to it. (Aspvall, Plass &amp; Tarjan, 1979; Krom, 1967.)
      </p>
    </div>
  );
}
