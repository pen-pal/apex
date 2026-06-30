// Classic 5-stage pipeline hazards — why a CPU can't just start one instruction every cycle, and how
// forwarding rescues most of the lost time. Stages: IF (fetch), ID (decode/read regs), EX (execute),
// MEM (memory), WB (write back). A data hazard happens when an instruction needs a register an earlier,
// still-in-flight instruction hasn't written yet. WITHOUT forwarding the reader must wait until the
// writer's WB (≈3 bubbles). WITH forwarding the EX result is bypassed straight to the next EX, erasing
// the stall — EXCEPT the load-use hazard: a load's value isn't ready until after MEM, so an instruction
// that uses it on the very next cycle still eats exactly one bubble. We compute each stage's cycle for
// an in-order single-issue pipeline, exactly. Reference: Patterson & Hennessy, Computer Organization ch.4.

export interface Instr { text: string; dest: string | null; srcs: string[]; isLoad: boolean }
export interface Timing { instr: Instr; if: number; id: number; ex: number; mem: number; wb: number; stalledBy: number | null }
export interface PipelineResult { rows: Timing[]; cycles: number; idealCycles: number; stalls: number; cpi: number }

/** Cycle-accurate schedule of an in-order, single-issue 5-stage pipeline. Cycles are 1-indexed: the
 *  first instruction does IF in cycle 1, EX in cycle 3. With forwarding, ALU→ALU costs nothing and a
 *  load→use costs one bubble; without it, every RAW dependency waits for the producer's WB. */
export function simulate(instrs: Instr[], forwarding: boolean): PipelineResult {
  const n = instrs.length;
  const ex: number[] = [];
  const stalledBy: (number | null)[] = [];

  for (let i = 0; i < n; i++) {
    let e = i + 3;                              // earliest EX given in-order fetch (instr i fetched cycle i+1)
    if (i > 0) e = Math.max(e, ex[i - 1] + 1);  // one EX slot per cycle, in program order
    let cause: number | null = null;
    for (const s of instrs[i].srcs) {
      // most recent earlier writer of this register
      let j = -1;
      for (let k = i - 1; k >= 0; k--) if (instrs[k].dest === s) { j = k; break; }
      if (j < 0) continue;
      const need = forwarding ? (instrs[j].isLoad ? ex[j] + 2 : ex[j] + 1) : ex[j] + 3;
      if (need > e) { e = need; cause = j; }
    }
    // a stall exists only if this instruction was pushed later than back-to-back issue would allow
    stalledBy[i] = i > 0 && e > ex[i - 1] + 1 ? cause : null;
    ex[i] = e;
  }

  const rows: Timing[] = instrs.map((instr, i) => ({
    instr, if: ex[i] - 2, id: ex[i] - 1, ex: ex[i], mem: ex[i] + 1, wb: ex[i] + 2, stalledBy: stalledBy[i],
  }));
  const cycles = n ? ex[n - 1] + 2 : 0;
  const idealCycles = n ? n + 4 : 0;
  return { rows, cycles, idealCycles, stalls: cycles - idealCycles, cpi: n ? cycles / n : 0 };
}

/** Tiny parser: "lw r1, 0(r2)" / "add r3, r1, r2" → an Instr (regs are r-tokens; first is dest). */
export function parse(line: string): Instr {
  const op = line.trim().split(/\s+/)[0].toLowerCase();
  const regs = line.match(/r\d+/g) ?? [];
  const isLoad = op === 'lw' || op === 'ld' || op === 'load';
  const isStore = op === 'sw' || op === 'st' || op === 'store';
  // store writes no register; its regs are all sources. otherwise first reg is the destination.
  if (isStore) return { text: line.trim(), dest: null, srcs: regs, isLoad: false };
  return { text: line.trim(), dest: regs[0] ?? null, srcs: regs.slice(1), isLoad };
}

export const parseProgram = (src: string): Instr[] => src.split('\n').map((l) => l.trim()).filter(Boolean).map(parse);
