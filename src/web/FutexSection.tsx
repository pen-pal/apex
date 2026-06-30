// futex, made visible. Pick a workload of lock/unlock operations and watch the lock word: an uncontended
// lock or unlock is a green userspace atomic with NO syscall; only a thread that must block (FUTEX_WAIT) or
// a release that must wake a waiter (FUTEX_WAKE) traps red into the kernel. The tally makes the point: a
// mostly-uncontended mutex is almost free — you pay the kernel only for real contention. Real model from
// futex.ts.
import { useMemo, useState } from 'react';
import { run, type Op } from './futex';

const L = (t: string): Op => ({ thread: t, kind: 'lock' });
const U = (t: string): Op => ({ thread: t, kind: 'unlock' });

const SCENARIOS: { id: string; label: string; ops: Op[] }[] = [
  { id: 'uncontended', label: 'uncontended (1 thread)', ops: [L('T1'), U('T1'), L('T1'), U('T1'), L('T1'), U('T1')] },
  { id: 'contended', label: 'two threads contend', ops: [L('T1'), L('T2'), U('T1'), U('T2')] },
  { id: 'mixed', label: 'mostly uncontended + one clash', ops: [L('T1'), U('T1'), L('T1'), U('T1'), L('T1'), L('T2'), U('T1'), U('T2')] },
  { id: 'pileup', label: 'three-thread pile-up', ops: [L('A'), L('B'), L('C'), U('A'), U('B'), U('C')] },
];

const STATE_LABEL = ['free', 'locked', 'locked + waiters'];

export function FutexSection() {
  const [sid, setSid] = useState('mixed');
  const scenario = SCENARIOS.find((s) => s.id === sid)!;
  const res = useMemo(() => run(scenario.ops), [sid]);
  const kernelPct = res.userOps ? Math.round((res.syscalls / res.userOps) * 100) : 0;

  return (
    <div className="ftx">
      <p className="ftx-intro">
        A <strong>futex</strong>-backed mutex keeps its lock word in ordinary userspace memory. The common
        case — lock a free mutex, unlock one nobody's waiting on — is a single atomic <strong>compare-and-swap
        with no system call</strong>. Only when a thread must <strong>block</strong> (lock is held) or
        <strong> wake</strong> someone (releasing to a waiter) does it trap into the kernel. So contention,
        not locking, is what costs.
      </p>

      <div className="ftx-scenarios">
        {SCENARIOS.map((s) => (
          <button key={s.id} type="button" className={`ftx-sbtn ${sid === s.id ? 'on' : ''}`} onClick={() => setSid(s.id)}>{s.label}</button>
        ))}
      </div>

      <div className="ftx-trace">
        {res.steps.map((st, i) => (
          <div key={i} className={`ftx-step ${st.syscall ? 'kernel' : 'user'}`}>
            <span className="ftx-op"><b>{st.op.thread}</b> {st.op.kind}</span>
            <span className="ftx-state">word = {st.state} <i>({STATE_LABEL[st.state]})</i></span>
            <span className="ftx-owner">{st.owner ? `held by ${st.owner}` : 'free'}</span>
            {st.syscall
              ? <span className="ftx-sys">⛢ syscall: {st.syscall}{st.blocked ? ' (sleeps)' : ''}</span>
              : <span className="ftx-fast">✓ userspace only</span>}
          </div>
        ))}
      </div>

      <div className="ftx-tally">
        <div className="ftx-stat"><span>operations</span><b>{res.userOps}</b></div>
        <div className="ftx-stat ok"><span>userspace-only</span><b>{res.userOps - res.syscalls}</b></div>
        <div className={`ftx-stat ${res.syscalls ? 'bad' : 'ok'}`}><span>kernel syscalls</span><b>{res.syscalls}</b></div>
        <div className={`ftx-stat ${kernelPct > 0 ? 'bad' : 'ok'}`}><span>in the kernel</span><b>{kernelPct}%</b></div>
      </div>

      <p className="ftx-foot">
        That's why a <code>pthread_mutex</code>, Go's <code>sync.Mutex</code>, and Rust's <code>Mutex</code> are
        cheap under low contention — the hot path never leaves userspace. The kernel side keeps a wait queue
        keyed by the futex's physical address, so threads on different mappings of the same memory still
        rendezvous. The real implementations add a spin-then-sleep adaptive wait (briefly busy-loop before
        FUTEX_WAIT, betting the lock frees quickly), the three-state 0/1/2 dance to avoid a lost-wakeup race,
        and FUTEX_WAKE counts to wake just one waiter and avoid the <strong>thundering herd</strong>. The same
        primitive underlies condition variables, semaphores, and <code>std::atomic::wait</code>. (futex(2);
        Drepper, "Futexes Are Tricky.")
      </p>
    </div>
  );
}
