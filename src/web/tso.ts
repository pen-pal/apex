// Memory consistency & store buffers — why two threads can BOTH read the old value, and how a fence
// forbids it. The store-buffer litmus test (Dekker's core): x=y=0, then
//     Core 0:  x = 1;  r0 = y          Core 1:  y = 1;  r1 = x
// Under Sequential Consistency the outcome r0=r1=0 is IMPOSSIBLE — some total order of the four
// operations must put a store before the other core's load. Real x86 hardware allows it: each core
// buffers its store in a private FIFO and reads the other variable from memory before the buffer
// drains, so both loads see 0. An MFENCE drains the buffer before the load, forbidding it again.
// We enumerate the ENTIRE reachable state space, so the allowed/forbidden outcomes are exact, not
// sampled. Reference: Sewell et al., "x86-TSO: A Rigorous and Usable Programmer's Model" (CACM 2010).

export type Instr =
  | { op: 'store'; var: string; val: number }
  | { op: 'load'; var: string; reg: string }
  | { op: 'fence' };
export type Model = 'SC' | 'TSO';

interface State { pc: number[]; buf: { var: string; val: number }[][]; mem: Record<string, number>; reg: Record<string, number> }

const ser = (s: State) =>
  JSON.stringify([s.pc, s.buf, Object.entries(s.mem).sort(), Object.entries(s.reg).sort()]);
const cloneState = (s: State): State => ({ pc: [...s.pc], buf: s.buf.map((b) => b.map((e) => ({ ...e }))), mem: { ...s.mem }, reg: { ...s.reg } });

/** Enumerate every reachable final assignment of `resultRegs` over all interleavings (and, under TSO,
 *  all store-buffer drain orders). Returns the distinct outcomes as comma-joined "name=value" rows. */
export function outcomes(programs: Instr[][], model: Model, resultRegs: string[]): string[] {
  const vars = new Set<string>();
  for (const p of programs) for (const i of p) if (i.op !== 'fence') vars.add(i.var);
  const mem0: Record<string, number> = {}; for (const v of vars) mem0[v] = 0;

  const init: State = { pc: programs.map(() => 0), buf: programs.map(() => []), mem: mem0, reg: {} };
  const results = new Set<string>();
  const visited = new Set<string>();

  const fmt = (s: State) => resultRegs.map((r) => `${r}=${s.reg[r] ?? 0}`).join(', ');

  const dfs = (s: State) => {
    const key = ser(s);
    if (visited.has(key)) return;
    visited.add(key);

    const done = s.pc.every((pc, i) => pc >= programs[i].length);
    const drained = s.buf.every((b) => b.length === 0);
    if (done && drained) { results.add(fmt(s)); return; }

    for (let i = 0; i < programs.length; i++) {
      // (a) execute core i's next instruction
      if (s.pc[i] < programs[i].length) {
        const instr = programs[i][s.pc[i]];
        if (instr.op === 'store') {
          const n = cloneState(s);
          if (model === 'SC') n.mem[instr.var] = instr.val; else n.buf[i].push({ var: instr.var, val: instr.val });
          n.pc[i]++; dfs(n);
        } else if (instr.op === 'load') {
          const n = cloneState(s);
          let v = n.mem[instr.var] ?? 0;
          if (model === 'TSO') { // store-to-load forwarding: own buffer shadows memory
            for (let k = n.buf[i].length - 1; k >= 0; k--) if (n.buf[i][k].var === instr.var) { v = n.buf[i][k].val; break; }
          }
          n.reg[instr.reg] = v; n.pc[i]++; dfs(n);
        } else { // fence: under TSO it may proceed only once this core's buffer is empty
          if (model === 'SC' || s.buf[i].length === 0) { const n = cloneState(s); n.pc[i]++; dfs(n); }
        }
      }
      // (b) under TSO, drain the front of core i's store buffer to memory at any time
      if (model === 'TSO' && s.buf[i].length > 0) {
        const n = cloneState(s);
        const e = n.buf[i].shift()!;
        n.mem[e.var] = e.val;
        dfs(n);
      }
    }
  };

  dfs(init);
  return [...results].sort();
}

/** The store-buffer (Dekker) litmus test, optionally with a fence before each load. */
export function sbTest(fenced: boolean): Instr[][] {
  const fence: Instr[] = fenced ? [{ op: 'fence' }] : [];
  return [
    [{ op: 'store', var: 'x', val: 1 }, ...fence, { op: 'load', var: 'y', reg: 'r0' }],
    [{ op: 'store', var: 'y', val: 1 }, ...fence, { op: 'load', var: 'x', reg: 'r1' }],
  ];
}

/** Did the weak outcome r0=r1=0 (both loads see the stale value) survive? */
export const allowsBothZero = (rows: string[]) => rows.includes('r0=0, r1=0');
