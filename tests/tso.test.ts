import { describe, it, expect } from 'vitest';
import { outcomes, sbTest, allowsBothZero } from '../src/web/tso';

describe('store-buffer litmus test — SC vs x86-TSO', () => {
  it('Sequential Consistency FORBIDS r0=r1=0', () => {
    const rows = outcomes(sbTest(false), 'SC', ['r0', 'r1']);
    expect(allowsBothZero(rows)).toBe(false);
    // the three SC-legal outcomes, nothing else
    expect(rows).toEqual(['r0=0, r1=1', 'r0=1, r1=0', 'r0=1, r1=1']);
  });

  it('x86-TSO ALLOWS r0=r1=0 (both cores read past their own buffered store)', () => {
    const rows = outcomes(sbTest(false), 'TSO', ['r0', 'r1']);
    expect(allowsBothZero(rows)).toBe(true);
    // every SC outcome is still reachable, plus the weak one
    expect(rows).toEqual(['r0=0, r1=0', 'r0=0, r1=1', 'r0=1, r1=0', 'r0=1, r1=1']);
  });

  it('an MFENCE before each load drains the buffer and forbids r0=r1=0 again', () => {
    const rows = outcomes(sbTest(true), 'TSO', ['r0', 'r1']);
    expect(allowsBothZero(rows)).toBe(false);
    expect(rows).toEqual(['r0=0, r1=1', 'r0=1, r1=0', 'r0=1, r1=1']);
  });
});

describe('store-to-load forwarding', () => {
  it('a core reads its OWN buffered store even before it reaches memory (TSO)', () => {
    // single core: store x=1 then load x → must observe 1 via forwarding, never the stale 0
    const prog = [[{ op: 'store', var: 'x', val: 1 }, { op: 'load', var: 'x', reg: 'r0' }]] as const;
    const rows = outcomes(prog as never, 'TSO', ['r0']);
    expect(rows).toEqual(['r0=1']);
  });
});

describe('the enumeration is exhaustive and model-correct', () => {
  it('message passing: TSO preserves store order within a core, so mp has no surprise here', () => {
    // Core0: data=1; flag=1   Core1: r0=flag; r1=data
    // x86-TSO keeps a single core's stores in order (FIFO buffer), so r0=1,r1=0 is NOT allowed.
    const prog = [
      [{ op: 'store', var: 'data', val: 1 }, { op: 'store', var: 'flag', val: 1 }],
      [{ op: 'load', var: 'flag', reg: 'r0' }, { op: 'load', var: 'data', reg: 'r1' }],
    ] as Parameters<typeof outcomes>[0];
    const rows = outcomes(prog, 'TSO', ['r0', 'r1']);
    expect(rows).not.toContain('r0=1, r1=0'); // would require store reordering, which TSO forbids
  });
});
