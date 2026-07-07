// seccomp sandbox puzzle — you write the syscall filter. A program does legitimate work (openat/read/write/close)
// and then gets exploited into calling execve("/bin/sh"). Toggle which syscalls the allowlist permits and pick the
// default action; run it and watch the trace. Too tight kills the program mid-work; too loose lets execve through
// and the exploit escapes. Win = the program finishes AND execve is blocked. Real semantics in seccomp.ts.
import { useMemo, useState } from 'react';
import { run, verdict, type Filter, type Syscall, type Action } from './seccomp';

const TRACE: Syscall[] = [
  { name: 'openat' }, { name: 'read' }, { name: 'write' }, { name: 'close' }, { name: 'execve', danger: true },
];
const LAST_LEGIT = 3; // 'close'
const SYSCALLS: { name: string; danger?: boolean; note: string }[] = [
  { name: 'openat', note: 'open the config file' },
  { name: 'read', note: 'read input' },
  { name: 'write', note: 'write output' },
  { name: 'close', note: 'close the file' },
  { name: 'execve', danger: true, note: 'spawn a shell — the exploit' },
];

export function SeccompSection() {
  const [allow, setAllow] = useState<Set<string>>(new Set(['openat', 'read']));
  const [def, setDef] = useState<Action>('kill');

  const filter: Filter = useMemo(() => ({ allow: [...allow], def }), [allow, def]);
  const outcome = useMemo(() => run(filter, TRACE), [filter]);
  const v = verdict(outcome, LAST_LEGIT);
  const toggle = (n: string) => setAllow((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });

  const badge = (a: Action) => a === 'allow' ? 'scmp-allow' : a === 'errno' ? 'scmp-errno' : 'scmp-kill';

  return (
    <div className="scmp">
      <div className="scmp-cols">
        <div className="scmp-panel">
          <div className="scmp-lbl">seccomp filter — allowlist</div>
          {SYSCALLS.map((sc) => (
            <button type="button" key={sc.name} className={`scmp-sys ${allow.has(sc.name) ? 'on' : ''} ${sc.danger ? 'scmp-danger' : ''}`} onClick={() => toggle(sc.name)}>
              <span className="scmp-chk">{allow.has(sc.name) ? '☑' : '☐'}</span>
              <code>{sc.name}</code>
              <span className="scmp-note">{sc.danger ? '⚠ ' : ''}{sc.note}</span>
            </button>
          ))}
          <div className="scmp-def">
            default for everything else:
            {(['kill', 'errno'] as Action[]).map((a) => (
              <button type="button" key={a} className={`scmp-defbtn ${def === a ? 'on' : ''}`} onClick={() => setDef(a)}>
                {a === 'kill' ? 'KILL process' : 'return EPERM'}
              </button>
            ))}
          </div>
        </div>

        <div className="scmp-panel">
          <div className="scmp-lbl">execution — the program's syscalls, top to bottom</div>
          <div className="scmp-trace">
            {TRACE.map((sc, i) => {
              const step = outcome.steps[i];
              const reached = !!step;
              const cls = !reached ? 'scmp-skipped' : badge(step.action);
              return (
                <div key={i} className={`scmp-step ${cls} ${sc.danger ? 'scmp-drow' : ''}`}>
                  <code>{sc.name}{sc.danger ? '("/bin/sh")' : ''}</code>
                  <span className="scmp-fate">
                    {!reached ? 'never ran' : step.action === 'allow' ? '→ allowed' : step.action === 'errno' ? '→ EPERM (blocked)' : '✗ KILLED here'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`scmp-verdict scmp-${v}`}>
        <strong>
          {v === 'secure' ? '✓ Sandboxed.' : v === 'escaped' ? '✗ Sandbox escaped.' : '✗ Program broken.'}
        </strong>{' '}
        {v === 'secure'
          ? 'The program completed its work and execve was blocked — even with code execution, the exploit goes nowhere. Minimal allowlist, deny by default: that’s the whole idea.'
          : v === 'escaped'
            ? 'execve is on your allowlist, so the exploit spawned a shell. A seccomp profile that permits the dangerous syscall protects nothing — keep execve/ptrace/socket off unless the program truly needs them.'
            : 'Your filter killed the program while it was still doing legitimate work (a syscall it needs isn’t allowed). Add the syscalls the program actually makes — but no more.'}
      </div>

      <p className="scmp-foot">
        seccomp-BPF lets a process <strong>voluntarily drop</strong> the right to make syscalls outside a filter — so a
        later compromise is boxed in. It’s deny-by-default done right: enumerate the handful of syscalls the program
        needs and <strong>KILL</strong> (or EPERM) everything else, so <code>execve</code>, <code>ptrace</code>, and
        raw <code>socket</code> calls fail even after an attacker has code running. Docker ships a default profile,
        Chrome sandboxes its renderers this way, and systemd exposes it as <code>SystemCallFilter=</code>. Real filters
        match on syscall <em>numbers</em> and can inspect arguments; the trade-off is the same one you just felt — too
        tight breaks the app, too loose is theatre. (Linux seccomp-BPF.)
      </p>
    </div>
  );
}
