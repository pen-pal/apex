import { describe, it, expect } from 'vitest';
import { run, type Op } from '../src/web/futex';

const L = (t: string): Op => ({ thread: t, kind: 'lock' });
const U = (t: string): Op => ({ thread: t, kind: 'unlock' });

describe('futex — the uncontended fast path costs no syscall', () => {
  it('a single thread locking/unlocking never enters the kernel', () => {
    const r = run([L('T1'), U('T1'), L('T1'), U('T1')]);
    expect(r.syscalls).toBe(0);
    expect(r.steps.every((s) => s.fastPath)).toBe(true);
    expect(r.userOps).toBe(4);
  });
  it('uncontended cost stays zero no matter how many ops', () => {
    const ops = Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? L('T1') : U('T1')));
    expect(run(ops).syscalls).toBe(0);
  });
});

describe('contention falls into the kernel', () => {
  it('a blocked locker triggers FUTEX_WAIT; releasing to it triggers FUTEX_WAKE', () => {
    // T1 holds; T2 must wait; T1 releases (wakes T2); T2 releases (no waiters)
    const r = run([L('T1'), L('T2'), U('T1'), U('T2')]);
    expect(r.steps[0]).toMatchObject({ fastPath: true, syscall: null, owner: 'T1' });
    expect(r.steps[1]).toMatchObject({ fastPath: false, syscall: 'FUTEX_WAIT', blocked: true });
    expect(r.steps[2]).toMatchObject({ syscall: 'FUTEX_WAKE', owner: 'T2' }); // lock handed to T2
    expect(r.steps[3]).toMatchObject({ fastPath: true, syscall: null });
    expect(r.syscalls).toBe(2);
  });

  it('the lock word reflects waiters: state 2 while contended, back to 1/0 after', () => {
    const r = run([L('T1'), L('T2'), L('T3'), U('T1'), U('T2'), U('T3')]);
    expect(r.steps[0].state).toBe(1);  // locked, no waiters
    expect(r.steps[1].state).toBe(2);  // T2 waiting
    expect(r.steps[2].state).toBe(2);  // T2,T3 waiting
    expect(r.steps[3]).toMatchObject({ owner: 'T2', state: 2 }); // wake T2, T3 still waits
    expect(r.steps[4]).toMatchObject({ owner: 'T3', state: 1 }); // wake T3, none left
    expect(r.steps[5]).toMatchObject({ owner: null, state: 0, fastPath: true });
    expect(r.syscalls).toBe(4); // 2 waits + 2 wakes
  });

  it('hands the lock to waiters in FIFO order', () => {
    const r = run([L('A'), L('B'), L('C'), U('A'), U('B')]);
    expect(r.steps[3].owner).toBe('B');
    expect(r.steps[4].owner).toBe('C');
  });

  it('syscalls scale with contention, not with total ops', () => {
    const mostlyUncontended = run([L('T1'), U('T1'), L('T1'), U('T1'), L('T1'), L('T2'), U('T1'), U('T2')]);
    expect(mostlyUncontended.userOps).toBe(8);
    expect(mostlyUncontended.syscalls).toBe(2); // only the one contended hand-off
  });
});
