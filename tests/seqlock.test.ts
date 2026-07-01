import { describe, it, expect } from 'vitest';
import { writerOps, readerOps, execute, seqlockOutcome, naiveOutcome, interleavings, type State } from '../src/web/seqlock';

const INIT: State = { seq: 0, a: 1, b: 1 };                // generation 1, consistent
const ALL = interleavings(writerOps(1), readerOps());       // every reader/writer interleaving

describe('the seqlock protocol', () => {
  it('enumerates all C(8,4) = 70 interleavings of the 4 writer and 4 reader steps', () => {
    expect(ALL.length).toBe(70);
  });

  it('EXHAUSTIVE: the seqlock reader never accepts a torn read — it is always consistent or a retry', () => {
    for (const order of ALL) {
      const o = seqlockOutcome(execute(order, INIT).regs);
      if (o.kind === 'ok') expect(o.a).toBe(o.b);           // any accepted snapshot has a === b
      else expect(o.kind).toBe('retry');                    // otherwise it must retry (never 'torn')
    }
  });

  it('every accepted snapshot is a whole generation (1,1) or (2,2) — never mixed', () => {
    const accepted = ALL.map((o) => seqlockOutcome(execute(o, INIT).regs)).filter((o) => o.kind === 'ok');
    expect(accepted.length).toBeGreaterThan(0);
    for (const o of accepted as { a: number; b: number }[]) expect([o.a, o.b]).toContain(o.a === 1 ? 1 : 2);
  });

  it('a naive lockless reader DOES tear on some interleavings (the problem seqlock solves)', () => {
    const torn = ALL.filter((o) => naiveOutcome(execute(o, INIT).regs).kind === 'torn');
    expect(torn.length).toBeGreaterThan(0);
    // and on exactly those, the seqlock reader saves us by retrying
    for (const order of torn) expect(seqlockOutcome(execute(order, INIT).regs).kind).toBe('retry');
  });
});

describe('the odd/even counter semantics', () => {
  it('reads while the counter is odd (write in progress) always retry', () => {
    // writer starts (odd), then the reader runs fully, then the writer finishes
    const w = writerOps(1), r = readerOps();
    const order = [w[0], w[1], ...r, w[2], w[3]]; // seq→odd, a=2, [reader], b=2, seq→even
    const { regs } = execute(order, INIT);
    expect(regs.s1 % 2).toBe(1);                           // saw an odd counter
    expect(seqlockOutcome(regs).kind).toBe('retry');
  });
  it('a clean read after the writer finishes returns the new generation', () => {
    const w = writerOps(1), r = readerOps();
    const { regs } = execute([...w, ...r], INIT);
    expect(seqlockOutcome(regs)).toEqual({ kind: 'ok', a: 2, b: 2 });
  });
  it('a clean read before the writer starts returns the old generation', () => {
    const w = writerOps(1), r = readerOps();
    const { regs } = execute([...r, ...w], INIT);
    expect(seqlockOutcome(regs)).toEqual({ kind: 'ok', a: 1, b: 1 });
  });
});
