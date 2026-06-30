// io_uring — Linux's modern async I/O, and why it leaves epoll (and plain read/write) behind on syscall
// cost. Classic blocking I/O is one syscall PER operation. epoll improves *readiness* notification but you
// still issue a read/write syscall for every ready fd — it tells you WHEN, not does the I/O for you.
// io_uring sets up two shared ring buffers in memory the app and kernel both see: the SUBMISSION queue (SQ,
// app→kernel) and the COMPLETION queue (CQ, kernel→app). You fill the SQ with many requests and submit them
// all with ONE io_uring_enter syscall; the kernel performs the I/O asynchronously and posts results to the
// CQ, which you reap with NO syscall at all. With SQPOLL, a kernel thread polls the SQ so even enter() goes
// away — zero syscalls on the hot path. That's how io_uring drives millions of IOPS from one thread.
// Reference: Jens Axboe, "Efficient IO with io_uring" (2019); io_uring(7).

export type Mode = 'blocking' | 'epoll' | 'iouring' | 'iouring-sqpoll';

/** Syscalls needed to perform `ops` I/O operations under each model, given an io_uring batch / epoll ready
 *  batch size. blocking = 1 syscall per op; epoll = a read per op PLUS a wait per batch of ready fds;
 *  io_uring = one io_uring_enter per submitted batch (completions reaped from the CQ with no syscall);
 *  io_uring+SQPOLL = 0 (a kernel thread consumes the SQ). */
export function syscalls(mode: Mode, ops: number, batch: number): number {
  const b = Math.max(1, batch);
  switch (mode) {
    case 'blocking': return ops;
    case 'epoll': return ops + Math.ceil(ops / b);
    case 'iouring': return Math.ceil(ops / b);
    case 'iouring-sqpoll': return 0;
  }
}

export function compareAll(ops: number, batch: number): Record<Mode, number> {
  return {
    blocking: syscalls('blocking', ops, batch),
    epoll: syscalls('epoll', ops, batch),
    iouring: syscalls('iouring', ops, batch),
    'iouring-sqpoll': syscalls('iouring-sqpoll', ops, batch),
  };
}

export interface RingState { sq: number[]; cq: number[]; inKernel: number[]; submitted: number; reaped: number }

/** One round of the io_uring loop: the app has queued `sq` requests; io_uring_enter submits up to `batch` of
 *  them (they move to the kernel), and any in-kernel requests that have finished post to the CQ. A tiny
 *  deterministic model for the visualization — kernel completes everything submitted in the prior round. */
export function ringRound(state: RingState, batch: number): RingState {
  const completed = state.inKernel;                 // last round's submissions are now done
  const toSubmit = state.sq.slice(0, batch);        // submit a batch from the SQ
  const remaining = state.sq.slice(batch);
  return {
    sq: remaining,
    inKernel: toSubmit,
    cq: [...state.cq, ...completed],
    submitted: state.submitted + toSubmit.length,
    reaped: state.reaped + completed.length,
  };
}
