// 2-SAT — the boolean satisfiability problem's easy sibling. Full SAT (clauses with any number of literals) is
// NP-complete, but restrict every clause to exactly TWO literals — "(x₀ OR ¬x₂) AND (x₁ OR x₂) AND …" — and it
// becomes solvable in LINEAR time by a beautiful reduction to graph theory. The key observation: a clause (a OR b)
// is logically identical to two implications, "if not a then b" and "if not b then a" (¬a ⇒ b, ¬b ⇒ a). So build
// an IMPLICATION GRAPH with a node for every literal (xᵢ and ¬xᵢ) and those two directed edges per clause. Now a
// chain of implications forces truth values: if you can reach ¬xᵢ from xᵢ AND reach xᵢ from ¬xᵢ, then xᵢ implies
// its own negation and vice versa — a contradiction, and the formula is UNSATISFIABLE. That "each reaches the
// other" is exactly the definition of being in the same STRONGLY CONNECTED COMPONENT. So: 2-SAT is unsatisfiable
// iff some variable and its negation land in the same SCC. If none do, an assignment falls out for free — process
// the components in reverse topological order and set each literal true when its component comes AFTER its
// negation's. One SCC pass (Tarjan, O(n+m)) decides satisfiability AND builds a witness. 2-SAT quietly powers real
// tools: labeling maps without overlaps, scheduling with either/or constraints, register allocation, and puzzle
// solvers. This models the implication graph, the SCC computation, and the assignment. Reference: Aspvall, Plass &
// Tarjan (1979).

export interface Clause { a: number; aTrue: boolean; b: number; bTrue: boolean } // (x_a==aTrue) OR (x_b==bTrue)

const lit = (v: number, val: boolean) => 2 * v + (val ? 0 : 1); // literal node: 2v = xv true, 2v+1 = xv false
const neg = (l: number) => l ^ 1;

export interface Solution { sat: boolean; assignment: boolean[]; comp: number[]; conflictVar: number }

/** Solve a 2-SAT instance over `n` variables. Returns SAT/UNSAT, a satisfying assignment, and SCC ids. */
export function solve2sat(n: number, clauses: Clause[]): Solution {
  const N = 2 * n;
  const adj: number[][] = Array.from({ length: N }, () => []);
  for (const c of clauses) {
    const la = lit(c.a, c.aTrue), lb = lit(c.b, c.bTrue);
    adj[neg(la)].push(lb); // ¬a ⇒ b
    adj[neg(lb)].push(la); // ¬b ⇒ a
  }

  // Tarjan SCC → comp[] in reverse topological order (sink components finish first → SMALLER ids; a node's comp
  // id is therefore GREATER than the ids of the components it can reach)
  const comp = new Array(N).fill(-1), low = new Array(N).fill(0), num = new Array(N).fill(-1), onStack = new Array(N).fill(false);
  const stack: number[] = []; let idx = 0, sccId = 0;
  const dfs = (u: number) => {
    const work: [number, number][] = [[u, 0]]; // iterative to avoid deep recursion
    while (work.length) {
      const top = work[work.length - 1]; const [v, pi] = top;
      if (pi === 0) { num[v] = low[v] = idx++; stack.push(v); onStack[v] = true; }
      if (pi < adj[v].length) {
        top[1]++; const w = adj[v][pi];
        if (num[w] === -1) work.push([w, 0]);
        else if (onStack[w]) low[v] = Math.min(low[v], num[w]);
      } else {
        if (low[v] === num[v]) { for (;;) { const x = stack.pop()!; onStack[x] = false; comp[x] = sccId; if (x === v) break; } sccId++; }
        work.pop();
        if (work.length) { const p = work[work.length - 1][0]; low[p] = Math.min(low[p], low[v]); }
      }
    }
  };
  for (let i = 0; i < N; i++) if (num[i] === -1) dfs(i);

  const assignment = new Array(n).fill(false);
  let conflictVar = -1;
  for (let v = 0; v < n; v++) {
    if (comp[2 * v] === comp[2 * v + 1]) { conflictVar = v; return { sat: false, assignment, comp, conflictVar }; }
    // Tarjan numbers later-finished SCCs with higher ids = EARLIER in topological order; pick the literal whose
    // component is later in topo order (smaller comp id) as true.
    assignment[v] = comp[2 * v] < comp[2 * v + 1];
  }
  return { sat: true, assignment, comp, conflictVar };
}

/** Check an assignment against the clauses (for verification). */
export function satisfies(clauses: Clause[], assignment: boolean[]): boolean {
  return clauses.every((c) => assignment[c.a] === c.aTrue || assignment[c.b] === c.bTrue);
}
