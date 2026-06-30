// futex — the "fast userspace mutex" that makes locking cheap. The trick: the lock word is an ordinary
// integer in shared userspace memory, and the COMMON case — lock an uncontended mutex, unlock one with no
// waiters — is a single atomic compare-and-swap with NO system call at all. Only when a thread actually has
// to BLOCK (the lock is held) or WAKE someone (it's releasing a lock others are waiting on) does it trap
// into the kernel via the futex syscall (FUTEX_WAIT / FUTEX_WAKE). So a mutex that's rarely contended costs
// almost nothing; you pay the kernel only for genuine contention. Every pthread mutex, Go's sync.Mutex, and
// Rust's std::sync::Mutex are built on this. State convention (Drepper, "Futexes Are Tricky"): 0 = free,
// 1 = locked / no waiters, 2 = locked / maybe waiters. Reference: futex(2); Drepper 2011.

export interface Op { thread: string; kind: 'lock' | 'unlock' }
export interface Step {
  op: Op; state: number; owner: string | null;
  fastPath: boolean;            // resolved entirely in userspace?
  syscall: 'FUTEX_WAIT' | 'FUTEX_WAKE' | null;
  blocked: boolean;            // this lock attempt had to sleep
}
export interface FutexResult { steps: Step[]; syscalls: number; userOps: number; waiters: string[] }

/** Run a sequence of lock/unlock ops on one futex-backed mutex, counting userspace atomics vs kernel calls.
 *  Uncontended lock/unlock are pure userspace (fastPath, no syscall); contention triggers FUTEX_WAIT, and
 *  releasing a lock with waiters triggers FUTEX_WAKE. */
export function run(ops: Op[]): FutexResult {
  let state = 0;                 // 0 free, 1 locked-no-waiters, 2 locked-maybe-waiters
  let owner: string | null = null;
  const waiters: string[] = [];
  const steps: Step[] = [];
  let syscalls = 0, userOps = 0;

  for (const op of ops) {
    userOps++; // every op does at least one atomic compare/exchange in userspace
    let fastPath = false;
    let syscall: Step['syscall'] = null;
    let blocked = false;

    if (op.kind === 'lock') {
      if (state === 0) {
        state = 1; owner = op.thread; fastPath = true;        // CAS 0→1, uncontended: no syscall
      } else {
        state = 2; waiters.push(op.thread);                   // mark contended and block
        syscall = 'FUTEX_WAIT'; syscalls++; blocked = true;
      }
    } else { // unlock (assumed by the current owner)
      if (waiters.length > 0) {
        const next = waiters.shift()!;                        // hand the lock to a waiter
        owner = next; state = waiters.length > 0 ? 2 : 1;
        syscall = 'FUTEX_WAKE'; syscalls++;
      } else {
        state = 0; owner = null; fastPath = true;             // CAS 1→0, no waiters: no syscall
      }
    }
    steps.push({ op, state, owner, fastPath, syscall, blocked });
  }
  return { steps, syscalls, userOps, waiters };
}
