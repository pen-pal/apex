import { describe, it, expect } from 'vitest';
import { classify, isLinearizable, isSequential, type Op } from '../src/web/consistency';

// Register starts at 0. Times are [start,end]; po = program order within a process.
const op = (id: string, proc: number, kind: 'w' | 'r', val: number, start: number, end: number, po: number): Op =>
  ({ id, proc, kind, val, start, end, po });

describe('linearizable history', () => {
  // P1 writes 1 [0,1]; P2 reads AFTER it and sees 1 [2,3]
  const h: Op[] = [op('w1', 1, 'w', 1, 0, 1, 0), op('r1', 2, 'r', 1, 2, 3, 0)];
  it('a read after a completed write that sees the value is linearizable', () => {
    expect(isLinearizable(h)).toBe(true);
    expect(classify(h).label).toBe('Linearizable');
  });
});

describe('sequential but NOT linearizable', () => {
  // P1 writes 1 [0,1]; P2 reads 0 AFTER the write completed in real time [2,3]
  const h: Op[] = [op('w1', 1, 'w', 1, 0, 1, 0), op('r0', 2, 'r', 0, 2, 3, 0)];
  it('real time forbids the stale read, but program order allows it', () => {
    expect(isLinearizable(h)).toBe(false); // real-time: w1 before r0 ⇒ r0 must see 1
    expect(isSequential(h)).toBe(true);    // order [r0, w1] respects (trivial) program order
    expect(classify(h).label).toBe('Sequential (not linearizable)');
  });
});

describe('not sequentially consistent', () => {
  // ONE process: write 1 then read 0 — program order says the read is after the write
  const h: Op[] = [op('w1', 1, 'w', 1, 0, 1, 0), op('r0', 1, 'r', 0, 2, 3, 1)];
  it('a process reading a value older than its own prior write is illegal everywhere', () => {
    expect(isSequential(h)).toBe(false);
    expect(isLinearizable(h)).toBe(false);
    expect(classify(h).label).toBe('Not sequentially consistent');
  });
});

describe('concurrent writes, linearizable both ways', () => {
  // P1 W(1)[0,2], P2 W(2)[1,3] overlap; P1 then reads [4,5] — must see 1 or 2 (the last)
  const h: Op[] = [
    op('w1', 1, 'w', 1, 0, 2, 0), op('w2', 2, 'w', 2, 1, 3, 0), op('r', 1, 'r', 2, 4, 5, 1),
  ];
  it('reading either concurrent write is fine; reading the later one here is linearizable', () => {
    expect(isLinearizable(h)).toBe(true);
  });
  it('but reading 1 after both writes when 2 was last-writable is still ok (overlap)', () => {
    const h2: Op[] = [op('w1', 1, 'w', 1, 0, 2, 0), op('w2', 2, 'w', 2, 1, 3, 0), op('r', 1, 'r', 1, 4, 5, 1)];
    expect(isLinearizable(h2)).toBe(true); // the writes overlap, so order w2,w1 is allowed
  });
});
