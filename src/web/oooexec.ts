// Out-of-order execution — why a modern CPU runs your instructions in a different order than you wrote them, and
// still gets the right answer. A simple in-order core issues instructions strictly in program order: when one
// stalls (say a load that misses cache and takes 100+ cycles), everything behind it stalls too, even instructions
// that don't depend on it. That wastes the CPU's many execution units. An OUT-OF-ORDER core instead tracks data
// dependencies and issues each instruction the moment its inputs are ready, regardless of program order, so
// independent work runs during the stall. The catch is false dependencies: if a later instruction reuses a
// register name an earlier one wrote (write-after-write) or read (write-after-read), naively reordering would
// corrupt it. REGISTER RENAMING fixes this — every write gets a fresh physical register, so the only orderings
// the hardware must respect are TRUE (read-after-write) data dependencies. With those and only those, the OoO
// completion time is the dataflow CRITICAL PATH, while the in-order time is dragged out by program-order
// stalling. Results are still committed (retired) in program order, via a reorder buffer, so the programmer sees
// a clean sequential machine even though execution scrambled underneath. This models both schedules from the true
// dependency graph and the speedup. Reference: Tomasulo (1967); Hennessy & Patterson, ch. 3 (ILP).

export interface Insn { text: string; dest: string; srcs: string[]; latency: number }
export interface Schedule { issue: number[]; finish: number[]; cycles: number }

/** For each instruction, the indices of the most-recent prior writer of each source register (true RAW deps). */
export function rawDeps(insns: Insn[]): number[][] {
  const lastWriter = new Map<string, number>();
  return insns.map((ins, i) => {
    const deps: number[] = [];
    for (const s of ins.srcs) { const p = lastWriter.get(s); if (p !== undefined) deps.push(p); }
    const unique = [...new Set(deps)];
    if (ins.dest) lastWriter.set(ins.dest, i); // set AFTER reading srcs, so RAW points at the prior writer
    return unique;
  });
}

/** Schedule the program. Out-of-order respects only RAW deps (renaming removes false deps); in-order also forces
 *  each instruction to issue no earlier than the previous one (program order). Unlimited issue width. */
export function schedule(insns: Insn[], inOrder: boolean): Schedule {
  const raw = rawDeps(insns);
  const issue = new Array(insns.length).fill(0);
  const finish = new Array(insns.length).fill(0);
  for (let i = 0; i < insns.length; i++) {
    let ready = 0;
    for (const p of raw[i]) ready = Math.max(ready, finish[p]);   // wait for producers' results
    if (inOrder && i > 0) ready = Math.max(ready, issue[i - 1]);  // program-order issue constraint
    issue[i] = ready;
    finish[i] = ready + insns[i].latency;
  }
  return { issue, finish, cycles: insns.length ? Math.max(...finish) : 0 };
}

/** Parse "r1 = load r0" / "r2 = r1 + r1" into an Insn (latency: load=4, everything else=1). */
export function parse(text: string): Insn {
  const m = text.match(/^\s*(\w+)\s*=\s*(.*)$/);
  if (!m) return { text, dest: '', srcs: [], latency: 1 };
  const dest = m[1];
  const rhs = m[2];
  const srcs = [...rhs.matchAll(/\b(r\d+)\b/g)].map((x) => x[1]);
  const latency = /\bload\b/.test(rhs) ? 4 : 1;
  return { text, dest, srcs, latency };
}
