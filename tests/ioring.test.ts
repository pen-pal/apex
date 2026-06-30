import { describe, it, expect } from 'vitest';
import { syscalls, compareAll, ringRound, type RingState } from '../src/web/ioring';

describe('io_uring — syscall cost per model', () => {
  it('blocking I/O is one syscall per operation', () => {
    expect(syscalls('blocking', 1000, 64)).toBe(1000);
  });
  it('epoll still issues a read per op, plus a wait per ready batch', () => {
    expect(syscalls('epoll', 1000, 64)).toBe(1000 + Math.ceil(1000 / 64)); // 1016
  });
  it('io_uring batches submissions: one enter per batch, completions reaped free', () => {
    expect(syscalls('iouring', 1000, 64)).toBe(Math.ceil(1000 / 64)); // 16
  });
  it('SQPOLL eliminates the syscall entirely on the hot path', () => {
    expect(syscalls('iouring-sqpoll', 1000, 64)).toBe(0);
  });
  it('io_uring slashes syscalls; epoll does NOT (its value is concurrency, not fewer syscalls)', () => {
    const c = compareAll(1000, 64);
    expect(c.epoll).toBeGreaterThanOrEqual(c.blocking); // epoll adds waits on top of a read per op
    expect(c.iouring).toBeLessThan(c.blocking / 10);    // io_uring is the real syscall win
    expect(c.iouring).toBeLessThan(c.epoll);
    expect(c['iouring-sqpoll']).toBe(0);
  });
  it('batch=1 degrades io_uring toward one syscall per op (no batching win)', () => {
    expect(syscalls('iouring', 50, 1)).toBe(50);
  });
});

describe('the submission/completion ring loop', () => {
  it('submits a batch per round and reaps prior completions from the CQ', () => {
    let s: RingState = { sq: [1, 2, 3, 4, 5], cq: [], inKernel: [], submitted: 0, reaped: 0 };
    s = ringRound(s, 2); // submit 1,2
    expect(s.inKernel).toEqual([1, 2]);
    expect(s.sq).toEqual([3, 4, 5]);
    expect(s.cq).toEqual([]);           // nothing finished yet
    s = ringRound(s, 2); // submit 3,4; 1,2 complete
    expect(s.inKernel).toEqual([3, 4]);
    expect(s.cq).toEqual([1, 2]);       // 1,2 reaped from CQ — no syscall
    expect(s.submitted).toBe(4);
  });
  it('drains everything: total reaped equals total submitted after enough rounds', () => {
    let s: RingState = { sq: [10, 20, 30], cq: [], inKernel: [], submitted: 0, reaped: 0 };
    for (let i = 0; i < 5; i++) s = ringRound(s, 2);
    expect(s.cq.sort((a, b) => a - b)).toEqual([10, 20, 30]);
    expect(s.reaped).toBe(3);
    expect(s.submitted).toBe(3);
  });
});
