// Cost-based query planning — why the ORDER a database joins tables in can change query time by orders
// of magnitude, and how the optimizer picks. The cost of a join plan is dominated by the size of the
// INTERMEDIATE results it materializes, so the optimizer estimates each candidate's cost from table
// cardinalities and join selectivities (the fraction of the cross-product a predicate keeps) and takes
// the cheapest. The classic lesson: join the most SELECTIVE edges first to keep intermediates tiny — a
// naive order can build a 50-million-row intermediate that a good order avoids entirely. We enumerate
// left-deep orders and score them with the System-R cost model. Reference: Selinger et al., "Access Path
// Selection in a Relational Database Management System" (SIGMOD 1979).

export interface Plan { order: string[]; cost: number; intermediates: number[] }

/** Estimate a left-deep plan's cost = sum of intermediate-result cardinalities. Each new table multiplies
 *  the running size by its cardinality and by every join selectivity connecting it to the already-joined
 *  tables (no connecting predicate ⇒ selectivity 1, i.e. a cross product). */
export function planCost(order: string[], card: Record<string, number>, sel: Record<string, number>): Plan {
  const key = (a: string, b: string) => [a, b].sort().join('~');
  const joined: string[] = [order[0]];
  let running = card[order[0]];
  const intermediates: number[] = [];
  let cost = 0;
  for (let k = 1; k < order.length; k++) {
    const t = order[k];
    let s = 1;
    for (const j of joined) s *= sel[key(t, j)] ?? 1;
    running = Math.round(running * card[t] * s);
    intermediates.push(running);
    cost += running;
    joined.push(t);
  }
  return { order, cost, intermediates };
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

/** Score every left-deep ordering and return them cheapest-first (the optimizer's search space). */
export function optimize(tables: string[], card: Record<string, number>, sel: Record<string, number>): Plan[] {
  return permutations(tables)
    .map((order) => planCost(order, card, sel))
    .sort((a, b) => a.cost - b.cost || (a.order.join() < b.order.join() ? -1 : 1));
}
