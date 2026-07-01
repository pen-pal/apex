import { describe, it, expect } from 'vitest';
import { rawDeps, schedule, parse } from '../src/web/oooexec';

const prog = (lines: string[]) => lines.map(parse);

describe('parsing and true dependencies', () => {
  it('parses dest/srcs and gives a load latency 4, ALU latency 1', () => {
    expect(parse('r1 = load r0')).toMatchObject({ dest: 'r1', srcs: ['r0'], latency: 4 });
    expect(parse('r2 = r1 + r1')).toMatchObject({ dest: 'r2', srcs: ['r1', 'r1'], latency: 1 });
  });
  it('RAW deps point at the most recent prior writer, not the instruction itself', () => {
    expect(rawDeps(prog(['r1 = load r0', 'r2 = r1 + r1', 'r3 = r8 + r8', 'r4 = r3 + r3'])))
      .toEqual([[], [0], [], [2]]);
    expect(rawDeps(prog(['r1 = r0 + r0', 'r1 = r1 + r2']))).toEqual([[], [0]]); // self-write → prior writer
  });
});

describe('scheduling', () => {
  it('out-of-order hides an independent chain under a cache-missing load', () => {
    const p = prog(['r1 = load r0', 'r2 = r1 + r1', 'r3 = r8 + r8', 'r4 = r3 + r3']);
    expect(schedule(p, true).cycles).toBe(6);   // in-order: the independent 3,4 stall behind the load-dependent 2
    expect(schedule(p, false).cycles).toBe(5);  // OoO: 3,4 run during the load
  });
  it('a pure dependency chain has no ILP: OoO equals in-order (the critical path)', () => {
    const p = prog(['r1 = r0 + r0', 'r2 = r1 + r1', 'r3 = r2 + r2', 'r4 = r3 + r3']);
    expect(schedule(p, false).cycles).toBe(4);
    expect(schedule(p, true).cycles).toBe(4);
  });
  it('fully independent instructions all run at once (unlimited width)', () => {
    const p = prog(['r1 = r0 + r0', 'r2 = r3 + r3', 'r4 = r5 + r5']);
    expect(schedule(p, false).cycles).toBe(1);
    expect(schedule(p, true).cycles).toBe(1);
  });
});

describe('the invariant, over random programs', () => {
  it('OoO is never slower than in-order, and is strictly faster on some', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    let strictlyFaster = 0;
    for (let t = 0; t < 20000; t++) {
      const n = 1 + rnd(12); const lines: string[] = [];
      for (let i = 0; i < n; i++) { const d = 'r' + rnd(6), a = 'r' + rnd(6), b = 'r' + rnd(6); lines.push(`${d} = ${rnd(4) === 0 ? 'load ' + a : a + ' + ' + b}`); }
      const p = prog(lines);
      const io = schedule(p, true).cycles, oo = schedule(p, false).cycles;
      expect(oo).toBeLessThanOrEqual(io);
      if (oo < io) strictlyFaster++;
    }
    expect(strictlyFaster).toBeGreaterThan(0);
  });
});
