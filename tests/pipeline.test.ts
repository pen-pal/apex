import { describe, it, expect } from 'vitest';
import { simulate, parse, parseProgram, type Instr } from '../src/web/pipeline';

// Program with a load-use hazard and a chain of ALU dependencies:
//   0: lw  r1, 0(r2)      (load → r1)
//   1: add r2, r1, r3     (uses r1 — load-use hazard on 0)
//   2: sub r4, r2, r5     (uses r2 from 1 — ALU→ALU)
//   3: add r6, r1, r4     (uses r1 from 0, r4 from 2)
const PROG: Instr[] = parseProgram(`lw r1, 0(r2)
add r2, r1, r3
sub r4, r2, r5
add r6, r1, r4`);

describe('the parser', () => {
  it('marks loads and splits dest vs source registers', () => {
    expect(parse('lw r1, 0(r2)')).toEqual({ text: 'lw r1, 0(r2)', dest: 'r1', srcs: ['r2'], isLoad: true });
    expect(parse('add r3, r1, r2')).toEqual({ text: 'add r3, r1, r2', dest: 'r3', srcs: ['r1', 'r2'], isLoad: false });
    expect(parse('sw r1, 0(r2)').dest).toBeNull(); // a store writes no register
  });
});

describe('with forwarding: only the load-use hazard stalls', () => {
  const r = simulate(PROG, true);
  it('the ALU chain runs back-to-back; the load-use costs exactly one bubble', () => {
    expect(r.rows.map((x) => x.ex)).toEqual([3, 5, 6, 7]); // instr1 delayed one cycle by the load
    expect(r.stalls).toBe(1);
    expect(r.cycles).toBe(9);                              // 4 + 4 fill + 1 stall
  });
  it('attributes the stall to the load instruction', () => {
    expect(r.rows[1].stalledBy).toBe(0); // add r2 waited on lw r1
    expect(r.rows[2].stalledBy).toBeNull();
  });
});

describe('without forwarding: every dependency waits for the writer’s WB', () => {
  const r = simulate(PROG, false);
  it('each RAW dependency inserts the full set of bubbles', () => {
    expect(r.rows.map((x) => x.ex)).toEqual([3, 6, 9, 12]);
    expect(r.cycles).toBe(14);
    expect(r.stalls).toBe(6); // far worse than the forwarding case (1)
  });
  it('forwarding strictly improves (or matches) the cycle count', () => {
    expect(simulate(PROG, true).cycles).toBeLessThan(r.cycles);
  });
});

describe('independent instructions never stall', () => {
  it('an all-independent stream runs at the ideal n+4 cycles, CPI→1', () => {
    const indep = parseProgram(`add r1, r2, r3
add r4, r5, r6
add r7, r8, r9`);
    const r = simulate(indep, true);
    expect(r.stalls).toBe(0);
    expect(r.cycles).toBe(7);          // 3 + 4
    expect(r.rows.map((x) => x.ex)).toEqual([3, 4, 5]); // back-to-back
  });
});
